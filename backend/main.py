from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import io
import uuid
import os
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from fairlearn.metrics import demographic_parity_difference, equalized_odds_difference
from fairlearn.preprocessing import CorrelationRemover

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
if os.getenv("GEMINI_API_KEY"):
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI(title="FairLens AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for datasets and models (for hackathon MVP)
datasets_store = {}
models_store = {}

class AnalyzeRequest(BaseModel):
    dataset_id: str
    target_column: str
    sensitive_column: str
    favorable_label: Any  # What is considered a "good" outcome (e.g., "Yes", 1)

class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    sensitive_column: str
    features: List[str]

@app.get("/")
def read_root():
    return {"message": "Welcome to FairLens AI API"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading CSV: {str(e)}")
        
    dataset_id = str(uuid.uuid4())
    datasets_store[dataset_id] = df
    
    summary = {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": df.columns.tolist(),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()}
    }
    return summary

@app.post("/analyze")
def analyze_bias(req: AnalyzeRequest):
    if req.dataset_id not in datasets_store:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    df = datasets_store[req.dataset_id].copy()
    
    if req.target_column not in df.columns or req.sensitive_column not in df.columns:
        raise HTTPException(status_code=400, detail="Columns not found in dataset")
        
    df.dropna(subset=[req.target_column, req.sensitive_column], inplace=True)
    
    # Try parsing favorable label to actual type of target column if needed, but str is common
    fav_label = req.favorable_label
    if str(df[req.target_column].dtype) in ['int64', 'float64']:
        try:
            fav_label = float(fav_label) if '.' in str(fav_label) else int(fav_label)
        except ValueError:
            pass
            
    sensitive_values = df[req.sensitive_column].unique()
    distribution = {}
    
    for val in sensitive_values:
        group_df = df[df[req.sensitive_column] == val]
        favorable_count = len(group_df[group_df[req.target_column] == fav_label])
        group_count = len(group_df)
        rate = favorable_count / group_count if group_count > 0 else 0
        distribution[str(val)] = {
            "count": group_count,
            "favorable_count": favorable_count,
            "approval_rate": round(rate, 4)
        }
    
    rates = [d["approval_rate"] for d in distribution.values() if d["count"] > 0] # Allow small groups for demo
    if len(rates) >= 2:
        max_rate = max(rates)
        min_rate = min(rates)
        demographic_parity_diff = max_rate - min_rate
        disparate_impact = min_rate / max_rate if max_rate > 0 else 0
    else:
        demographic_parity_diff = 0
        disparate_impact = 1
        
    bias_score = min(100, max(0, (1 - disparate_impact) * 100))
    if bias_score < 10:
         risk_level = "Low"
    elif bias_score < 30:
         risk_level = "Medium"
    else:
         risk_level = "High"

    base_explanation = f"Analyzed outcomes across '{req.sensitive_column}'. "
    sorted_groups = sorted(
        [item for item in distribution.items() if item[1]['count'] > 0],
        key=lambda x: x[1]['approval_rate'], reverse=True
    )
    if len(sorted_groups) >= 2:
        top_group = sorted_groups[0]
        bottom_group = sorted_groups[-1]
        diff_percent = round((top_group[1]['approval_rate'] - bottom_group[1]['approval_rate']) * 100, 1)
        base_explanation += f"Group '{bottom_group[0]}' is {diff_percent}% less likely to receive the favorable outcome compared to group '{top_group[0]}'."
        
    explanation = base_explanation
    
    # Try to use Gemini to enhance the explanation
    if os.getenv("GEMINI_API_KEY"):
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"""
            You are an AI fairness and bias expert. I have run a bias analysis on a dataset.
            The sensitive attribute is '{req.sensitive_column}'.
            The disparate impact ratio is {disparate_impact:.4f} and the demographic parity difference is {demographic_parity_diff:.4f}.
            The risk level is {risk_level}.
            
            Group distributions: {distribution}
            
            Provide a short, easy-to-understand 2-3 sentence explanation of what this means for fairness, and suggest one brief mitigation strategy. Keep it plain text, no markdown.
            """
            response = model.generate_content(prompt)
            if response.text:
                explanation = response.text.strip()
        except Exception as e:
            print(f"Gemini API error: {e}")
            pass
    
    return {
        "metrics": {
            "demographic_parity_difference": round(demographic_parity_diff, 4),
            "disparate_impact_ratio": round(disparate_impact, 4),
            "bias_score": round(bias_score, 1),
            "risk_level": risk_level
        },
        "distribution": distribution,
        "explanation": explanation
    }

@app.post("/train")
def train_model(req: TrainRequest):
    if req.dataset_id not in datasets_store:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    df = datasets_store[req.dataset_id].copy()
    features = req.features
    target = req.target_column
    sensitive = req.sensitive_column
    
    df = df.dropna(subset=features + [target, sensitive])
    
    le_dict = {}
    X = df[features].copy()
    for col in X.select_dtypes(include=['object', 'category']).columns:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        le_dict[col] = le
        
    y_le = LabelEncoder()
    y = y_le.fit_transform(df[target].astype(str))
    
    X_train, X_test, y_train, y_test, A_train, A_test = train_test_split(
        X, y, df[sensitive], test_size=0.3, random_state=42
    )
    
    model = LogisticRegression(max_iter=1000)
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    
    dp_diff = demographic_parity_difference(y_test, y_pred, sensitive_features=A_test)
    eo_diff = equalized_odds_difference(y_test, y_pred, sensitive_features=A_test)
    accuracy = model.score(X_test, y_test)
    
    return {
        "accuracy": round(accuracy, 4),
        "demographic_parity_difference": round(dp_diff, 4),
        "equalized_odds_difference": round(eo_diff, 4)
    }

@app.post("/mitigate")
def mitigate_bias(req: TrainRequest):
    if req.dataset_id not in datasets_store:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    df = datasets_store[req.dataset_id].copy()
    features = req.features
    target = req.target_column
    sensitive = req.sensitive_column
    
    df = df.dropna(subset=features + [target, sensitive])
    
    X = df[features].copy()
    for col in X.select_dtypes(include=['object', 'category']).columns:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        
    y_le = LabelEncoder()
    y = y_le.fit_transform(df[target].astype(str))
    
    sens_le = LabelEncoder()
    A = sens_le.fit_transform(df[sensitive].astype(str))
    
    X_train, X_test, y_train, y_test, A_train, A_test = train_test_split(
        X, y, A, test_size=0.3, random_state=42
    )
    
    model_baseline = LogisticRegression(max_iter=1000)
    model_baseline.fit(X_train, y_train)
    preds_baseline = model_baseline.predict(X_test)
    dp_diff_baseline = demographic_parity_difference(y_test, preds_baseline, sensitive_features=A_test)
    acc_baseline = model_baseline.score(X_test, y_test)
    
    X_train_mitig = X_train.copy()
    X_test_mitig = X_test.copy()
    X_train_mitig['sensitive_feat'] = A_train
    X_test_mitig['sensitive_feat'] = A_test
    
    cr = CorrelationRemover(sensitive_feature_ids=['sensitive_feat'])
    X_train_cr = cr.fit_transform(X_train_mitig)
    X_test_cr = cr.transform(X_test_mitig)
    
    model_mitig = LogisticRegression(max_iter=1000)
    model_mitig.fit(X_train_cr, y_train)
    preds_mitig = model_mitig.predict(X_test_cr)
    dp_diff_mitig = demographic_parity_difference(y_test, preds_mitig, sensitive_features=A_test)
    acc_mitig = model_mitig.score(X_test_cr, y_test)
    
    return {
        "before": {
            "accuracy": round(acc_baseline, 4),
            "demographic_parity_difference": round(dp_diff_baseline, 4)
        },
        "after": {
            "accuracy": round(acc_mitig, 4),
            "demographic_parity_difference": round(dp_diff_mitig, 4)
        },
        "technique": "CorrelationRemover"
    }
