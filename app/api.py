"""
FastAPI Inference REST API for Plant Leaf Disease Detection
Provides endpoints for health check, disease prediction, and Grad-CAM visual heatmaps.
"""

from pathlib import Path
import sys
import io
import time
import base64
import json

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, UploadFile, File, Query, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
import numpy as np
import torch
import torch.nn.functional as F

from src.config import CHECKPOINT_DIR, DEFAULT_CLASSES, DEVICE
from src.dataset import get_transforms
from src.segmentation import segment_leaf_hsv, segment_leaf_otsu
from src.models import build_transfer_model, CustomCNN, CBAMCNN
from src.explainability import GradCAM, overlay_heatmap, get_diagnosis_report


app = FastAPI(
    title="AgriVision Disease Inference API",
    description="RESTful Inference Endpoint for Plant Foliar Pathology Detection & Grad-CAM XAI",
    version="1.0.0"
)

# Enable CORS for cross-origin requests (web apps, mobile frontends)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model state singleton
class ModelContainer:
    model = None
    class_names = DEFAULT_CLASSES
    arch_name = "mobilenet_v3"


container = ModelContainer()


def load_inference_model():
    """Loads checkpoint weights into memory once at startup."""
    ckpt_path = CHECKPOINT_DIR / f"{container.arch_name}_best.pth"
    if not ckpt_path.exists():
        ckpt_path = CHECKPOINT_DIR / "best_model.pth"

    class_names = DEFAULT_CLASSES
    state_dict = None

    if ckpt_path.exists():
        ckpt = torch.load(ckpt_path, map_location=DEVICE)
        state_dict = ckpt.get("model_state_dict", ckpt)
        if "class_names" in ckpt:
            class_names = ckpt["class_names"]

    container.class_names = class_names

    if container.arch_name == "custom_cnn":
        model = CustomCNN(num_classes=len(class_names))
    elif container.arch_name == "cbam_cnn":
        model = CBAMCNN(num_classes=len(class_names))
    else:
        model = build_transfer_model(container.arch_name, num_classes=len(class_names), pretrained=False)

    if state_dict is not None:
        model.load_state_dict(state_dict)

    model.to(DEVICE)
    model.eval()
    container.model = model
    print(f"[API] Loaded {container.arch_name} with {len(class_names)} classes on {DEVICE}")


@app.on_event("startup")
def startup_event():
    load_inference_model()


@app.get("/", tags=["Info"])
def root():
    return {
        "service": "AgriVision Plant Leaf Disease Inference Service",
        "status": "online",
        "docs_url": "/docs",
        "predict_endpoint": "/predict",
        "health_endpoint": "/health"
    }


@app.get("/health", tags=["Monitoring"])
def health_check():
    return {
        "status": "healthy",
        "device": DEVICE,
        "architecture": container.arch_name,
        "classes_count": len(container.class_names),
        "supported_classes": container.class_names
    }


@app.post("/predict", tags=["Inference"])
def predict_leaf_disease(
    file: UploadFile = File(..., description="Image file of the plant leaf"),
    symptoms: str = Form("{}"),
    additional_observations: str = Form(""),
    include_heatmap: bool = Query(True, description="Whether to compute and return Grad-CAM heatmap base64"),
    seg_method: str = Query("none", pattern="^(none|hsv|otsu)$", description="Background segmentation method")
):
    """
    Classifies a plant leaf photograph and optionally generates a Grad-CAM heatmap overlay.
    """
    if container.model is None:
        load_inference_model()
        try:
    symptom_answers = json.loads(symptoms)

    if not isinstance(symptom_answers, dict):
        raise ValueError("Symptoms must be a JSON object")

    allowed_answers = {"Yes", "No", "Unsure"}

    for value in symptom_answers.values():
        if value not in allowed_answers and value != "":
            raise ValueError("Invalid symptom answer")

except (ValueError, TypeError):
    raise HTTPException(
        status_code=400,
        detail="Invalid questionnaire answers"
    )

if len(additional_observations) > 1000:
    raise HTTPException(
        status_code=400,
        detail="Additional observations are too long"
    )

    # Read and validate image
    try:
        image_bytes = file.file.read()
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    start_time = time.perf_counter()

    # Apply background suppression if requested
    img_np = np.array(pil_image)
    if seg_method == "hsv":
        processed_np, _ = segment_leaf_hsv(img_np)
        input_pil = Image.fromarray(processed_np)
    elif seg_method == "otsu":
        processed_np, _ = segment_leaf_otsu(img_np)
        input_pil = Image.fromarray(processed_np)
    else:
        input_pil = pil_image

    # Preprocess tensor
    transform = get_transforms(is_train=False)
    input_tensor = transform(input_pil).unsqueeze(0).to(DEVICE)

    # Prediction and Grad-CAM
    cam = GradCAM(container.model)
    heatmap, pred_idx, confidence = cam.generate_heatmap(input_tensor)
    pred_class = container.class_names[pred_idx] if pred_idx < len(container.class_names) else f"Class_{pred_idx}"
    report = get_diagnosis_report(pred_class, confidence)
    # Preliminary symptom assessment
symptom_weights = {
    "spots": 1,
    "yellowing": 1,
    "wilting": 2,
    "spreading": 2,
    "leaf_affected": 2,
    "multiple_leaves": 2
}

symptom_score = sum(
    weight
    for question, weight in symptom_weights.items()
    if symptom_answers.get(question) == "Yes"
)

if symptom_score <= 2:
    risk_level = "Low"
elif symptom_score <= 5:
    risk_level = "Moderate"
else:
    risk_level = "High"

symptom_assessment = {
    "score": symptom_score,
    "risk_level": risk_level,
    "answers": symptom_answers,
    "additional_observations": additional_observations
}

    # Top-3 predictions
    with torch.no_grad():
        logits = container.model(input_tensor)
        probs = F.softmax(logits, dim=1).squeeze().cpu().numpy()
    
    top3_indices = np.argsort(probs)[-3:][::-1]
    top3_list = [
        {"class": container.class_names[i], "probability": float(probs[i])}
        for i in top3_indices
    ]

    heatmap_base64 = None
    if include_heatmap:
        overlaid_pil, _ = overlay_heatmap(pil_image, heatmap, alpha=0.45)
        buffer = io.BytesIO()
        overlaid_pil.save(buffer, format="JPEG", quality=90)
        heatmap_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    return {
        "success": True,
        "plant": report["plant"],
        "condition": report["condition"],
        "is_healthy": report["is_healthy"],
        "confidence": round(confidence, 4),
        "remedy": report["remedy"],
        "top3_predictions": top3_list,
        "inference_latency_ms": round(elapsed_ms, 2),
        "gradcam_heatmap_base64": heatmap_base64
        "symptom_assessment": symptom_assessment,
    }
