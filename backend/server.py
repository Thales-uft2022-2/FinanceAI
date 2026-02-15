from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class CategoryCreate(BaseModel):
    name: str
    type: str  # "income" or "expense"
    icon: Optional[str] = "circle"
    color: Optional[str] = "#22C55E"

class CategoryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    type: str
    icon: str
    color: str
    user_id: str

class TransactionCreate(BaseModel):
    description: str
    amount: float
    type: str  # "income" or "expense"
    category_id: str
    date: Optional[str] = None

class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    category_id: Optional[str] = None
    date: Optional[str] = None

class TransactionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    description: str
    amount: float
    type: str
    category_id: str
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    date: str
    user_id: str

class GoalCreate(BaseModel):
    name: str
    target_amount: float
    current_amount: Optional[float] = 0.0
    deadline: Optional[str] = None

class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    deadline: Optional[str] = None

class GoalResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    target_amount: float
    current_amount: float
    deadline: Optional[str]
    user_id: str
    progress: float

class DashboardStats(BaseModel):
    total_balance: float
    total_income: float
    total_expenses: float
    transactions_count: int
    goals_count: int
    categories_by_expense: List[dict]
    recent_transactions: List[TransactionResponse]
    monthly_data: List[dict]

class AITipRequest(BaseModel):
    question: Optional[str] = None

class AITipResponse(BaseModel):
    tip: str
    context: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode = {"sub": user_id, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "name": user.name,
        "email": user.email,
        "password": hash_password(user.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Create default categories for the user
    default_categories = [
        {"name": "Salário", "type": "income", "icon": "briefcase", "color": "#22C55E"},
        {"name": "Freelance", "type": "income", "icon": "laptop", "color": "#10B981"},
        {"name": "Investimentos", "type": "income", "icon": "trending-up", "color": "#3B82F6"},
        {"name": "Outros", "type": "income", "icon": "plus-circle", "color": "#6366F1"},
        {"name": "Alimentação", "type": "expense", "icon": "utensils", "color": "#EF4444"},
        {"name": "Transporte", "type": "expense", "icon": "car", "color": "#F97316"},
        {"name": "Moradia", "type": "expense", "icon": "home", "color": "#8B5CF6"},
        {"name": "Saúde", "type": "expense", "icon": "heart", "color": "#EC4899"},
        {"name": "Educação", "type": "expense", "icon": "book-open", "color": "#14B8A6"},
        {"name": "Lazer", "type": "expense", "icon": "gamepad-2", "color": "#F59E0B"},
        {"name": "Compras", "type": "expense", "icon": "shopping-bag", "color": "#A855F7"},
        {"name": "Outros", "type": "expense", "icon": "more-horizontal", "color": "#6B7280"},
    ]
    
    for cat in default_categories:
        cat_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            **cat
        }
        await db.categories.insert_one(cat_doc)
    
    token = create_access_token(user_id)
    user_response = UserResponse(
        id=user_id,
        name=user.name,
        email=user.email,
        created_at=user_doc["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(user["id"])
    user_response = UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        created_at=user["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ==================== CATEGORY ROUTES ====================

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.categories.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return [CategoryResponse(**cat) for cat in categories]

@api_router.post("/categories", response_model=CategoryResponse)
async def create_category(category: CategoryCreate, current_user: dict = Depends(get_current_user)):
    cat_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        **category.model_dump()
    }
    await db.categories.insert_one(cat_doc)
    return CategoryResponse(**{k: v for k, v in cat_doc.items() if k != "_id"})

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.categories.delete_one({"id": category_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

# ==================== TRANSACTION ROUTES ====================

@api_router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    skip: int = 0,
    type: Optional[str] = None
):
    query = {"user_id": current_user["id"]}
    if type:
        query["type"] = type
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get categories for enrichment
    categories = await db.categories.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    cat_map = {cat["id"]: cat for cat in categories}
    
    result = []
    for t in transactions:
        cat = cat_map.get(t.get("category_id"), {})
        t["category_name"] = cat.get("name", "Outros")
        t["category_icon"] = cat.get("icon", "circle")
        t["category_color"] = cat.get("color", "#6B7280")
        result.append(TransactionResponse(**t))
    
    return result

@api_router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: TransactionCreate, current_user: dict = Depends(get_current_user)):
    trans_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "description": transaction.description,
        "amount": transaction.amount,
        "type": transaction.type,
        "category_id": transaction.category_id,
        "date": transaction.date or datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(trans_doc)
    
    # Get category info
    cat = await db.categories.find_one({"id": transaction.category_id}, {"_id": 0})
    return TransactionResponse(
        **{k: v for k, v in trans_doc.items() if k != "_id"},
        category_name=cat.get("name", "Outros") if cat else "Outros",
        category_icon=cat.get("icon", "circle") if cat else "circle",
        category_color=cat.get("color", "#6B7280") if cat else "#6B7280"
    )

@api_router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    transaction: TransactionUpdate,
    current_user: dict = Depends(get_current_user)
):
    update_data = {k: v for k, v in transaction.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.transactions.update_one(
        {"id": transaction_id, "user_id": current_user["id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    updated = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    cat = await db.categories.find_one({"id": updated.get("category_id")}, {"_id": 0})
    return TransactionResponse(
        **updated,
        category_name=cat.get("name", "Outros") if cat else "Outros",
        category_icon=cat.get("icon", "circle") if cat else "circle",
        category_color=cat.get("color", "#6B7280") if cat else "#6B7280"
    )

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.transactions.delete_one({"id": transaction_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted"}

# ==================== GOAL ROUTES ====================

@api_router.get("/goals", response_model=List[GoalResponse])
async def get_goals(current_user: dict = Depends(get_current_user)):
    goals = await db.goals.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    result = []
    for g in goals:
        progress = (g["current_amount"] / g["target_amount"] * 100) if g["target_amount"] > 0 else 0
        result.append(GoalResponse(**g, progress=min(progress, 100)))
    return result

@api_router.post("/goals", response_model=GoalResponse)
async def create_goal(goal: GoalCreate, current_user: dict = Depends(get_current_user)):
    goal_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        **goal.model_dump()
    }
    await db.goals.insert_one(goal_doc)
    progress = (goal.current_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0
    return GoalResponse(**{k: v for k, v in goal_doc.items() if k != "_id"}, progress=min(progress, 100))

@api_router.put("/goals/{goal_id}", response_model=GoalResponse)
async def update_goal(goal_id: str, goal: GoalUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in goal.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.goals.update_one(
        {"id": goal_id, "user_id": current_user["id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    updated = await db.goals.find_one({"id": goal_id}, {"_id": 0})
    progress = (updated["current_amount"] / updated["target_amount"] * 100) if updated["target_amount"] > 0 else 0
    return GoalResponse(**updated, progress=min(progress, 100))

@api_router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.goals.delete_one({"id": goal_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": "Goal deleted"}

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    
    # Get all transactions
    transactions = await db.transactions.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    
    # Calculate totals
    total_income = sum(t["amount"] for t in transactions if t["type"] == "income")
    total_expenses = sum(t["amount"] for t in transactions if t["type"] == "expense")
    total_balance = total_income - total_expenses
    
    # Get categories
    categories = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    cat_map = {cat["id"]: cat for cat in categories}
    
    # Calculate expenses by category
    expense_by_cat = {}
    for t in transactions:
        if t["type"] == "expense":
            cat_id = t.get("category_id", "other")
            if cat_id not in expense_by_cat:
                cat = cat_map.get(cat_id, {"name": "Outros", "color": "#6B7280"})
                expense_by_cat[cat_id] = {"name": cat["name"], "value": 0, "color": cat["color"]}
            expense_by_cat[cat_id]["value"] += t["amount"]
    
    categories_by_expense = list(expense_by_cat.values())
    
    # Get recent transactions
    recent = sorted(transactions, key=lambda x: x["date"], reverse=True)[:5]
    recent_transactions = []
    for t in recent:
        cat = cat_map.get(t.get("category_id"), {})
        recent_transactions.append(TransactionResponse(
            **t,
            category_name=cat.get("name", "Outros"),
            category_icon=cat.get("icon", "circle"),
            category_color=cat.get("color", "#6B7280")
        ))
    
    # Calculate monthly data (last 6 months)
    monthly_data = []
    now = datetime.now(timezone.utc)
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i*30)).replace(day=1)
        month_name = month_start.strftime("%b")
        
        month_income = sum(
            t["amount"] for t in transactions 
            if t["type"] == "income" and t["date"][:7] == month_start.strftime("%Y-%m")
        )
        month_expense = sum(
            t["amount"] for t in transactions 
            if t["type"] == "expense" and t["date"][:7] == month_start.strftime("%Y-%m")
        )
        monthly_data.append({
            "month": month_name,
            "income": month_income,
            "expense": month_expense
        })
    
    # Get goals count
    goals_count = await db.goals.count_documents({"user_id": user_id})
    
    return DashboardStats(
        total_balance=total_balance,
        total_income=total_income,
        total_expenses=total_expenses,
        transactions_count=len(transactions),
        goals_count=goals_count,
        categories_by_expense=categories_by_expense,
        recent_transactions=recent_transactions,
        monthly_data=monthly_data
    )

# ==================== AI TIPS ROUTES ====================

@api_router.post("/ai/tips", response_model=AITipResponse)
async def get_ai_tip(request: AITipRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    
    # Get user's financial data
    transactions = await db.transactions.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    goals = await db.goals.find({"user_id": user_id}, {"_id": 0}).to_list(20)
    
    total_income = sum(t["amount"] for t in transactions if t["type"] == "income")
    total_expenses = sum(t["amount"] for t in transactions if t["type"] == "expense")
    balance = total_income - total_expenses
    
    # Get categories breakdown
    categories = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    cat_map = {cat["id"]: cat["name"] for cat in categories}
    
    expense_breakdown = {}
    for t in transactions:
        if t["type"] == "expense":
            cat_name = cat_map.get(t.get("category_id"), "Outros")
            expense_breakdown[cat_name] = expense_breakdown.get(cat_name, 0) + t["amount"]
    
    # Build context
    context = f"""
Dados financeiros do usuário:
- Saldo total: R$ {balance:.2f}
- Total de receitas: R$ {total_income:.2f}
- Total de despesas: R$ {total_expenses:.2f}
- Número de transações: {len(transactions)}
- Número de metas: {len(goals)}

Gastos por categoria:
{chr(10).join([f'- {k}: R$ {v:.2f}' for k, v in expense_breakdown.items()])}

Metas do usuário:
{chr(10).join([f'- {g["name"]}: R$ {g["current_amount"]:.2f} de R$ {g["target_amount"]:.2f}' for g in goals]) if goals else 'Nenhuma meta definida'}
"""
    
    user_question = request.question or "Me dê uma dica financeira personalizada baseada nos meus dados."
    
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"finance-tips-{user_id}",
            system_message="""Você é um consultor financeiro pessoal especializado. Analise os dados financeiros do usuário e forneça dicas práticas, personalizadas e acionáveis. 
Seja conciso, amigável e motivador. Fale em português brasileiro.
Foque em:
1. Identificar padrões de gastos
2. Sugerir economias específicas
3. Ajudar a alcançar metas
4. Dar insights sobre saúde financeira"""
        ).with_model("openai", "gpt-5.2")
        
        message = UserMessage(text=f"{context}\n\nPergunta do usuário: {user_question}")
        response = await chat.send_message(message)
        
        return AITipResponse(tip=response, context=f"Análise baseada em {len(transactions)} transações")
    except Exception as e:
        logger.error(f"AI Error: {str(e)}")
        # Fallback tip
        if total_expenses > total_income:
            tip = "Seus gastos estão maiores que suas receitas. Considere revisar suas despesas e identificar onde pode economizar."
        elif not goals:
            tip = "Você ainda não definiu metas financeiras. Defina objetivos claros para manter o foco na sua saúde financeira!"
        else:
            tip = "Continue acompanhando suas finanças! Consistência é a chave para o sucesso financeiro."
        return AITipResponse(tip=tip, context="Dica baseada em análise simplificada")

# ==================== ROOT ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Finance App API v1.0"}

# Include router and setup middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
