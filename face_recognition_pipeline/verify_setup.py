import torch
print("GPU Available:", torch.cuda.is_available())  # Should print True if GPU is set up

import cv2
from ultralytics import YOLO
from mtcnn import MTCNN
import deepface
print("All libraries loaded successfully")
