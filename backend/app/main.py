from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import chat, booking, faq, request
from app.routers import payment
 

app = FastAPI(
    title="AIChieftain Hospitality API",
    version="1.0.0"
)

# CORS
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://chieftrain-1.onrender.com",
    "https://chief-train-hr5t.vercel.app"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(chat.router)
app.include_router(booking.router)
app.include_router(faq.router)
app.include_router(request.router)
app.include_router(payment.router)