#!/usr/bin/env python3
"""
Multi-Tenant Time Tracking System - Complete FastAPI application with SQLite
All-in-one file for easy deployment on any hosting provider
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import aiosqlite
from pydantic import BaseModel, Field, EmailStr
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import List, Optional
import jwt
import os
import uuid
import qrcode
import io
import base64
from pathlib import Path
from dotenv import load_dotenv
import asyncio

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configuration
DB_PATH = os.environ.get('DB_PATH', './database.db')
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 24 * 60  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(title="Multi-Tenant Time Tracking System")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database initialization
DATABASE_SCHEMA = """
-- Owners table
CREATE TABLE IF NOT EXISTS owners (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    company_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    position TEXT NOT NULL,
    number TEXT NOT NULL,
    qr_code TEXT NOT NULL,
    company_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(number, company_id)
);

-- Time entries table
CREATE TABLE IF NOT EXISTS time_entries (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    last_scan_time TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_number_company ON employees(number, company_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
"""

async def init_database():
    """Initialize the SQLite database"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(DATABASE_SCHEMA)
        await db.commit()

async def get_db():
    """Database connection dependency"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db

# Pydantic Models
class Owner(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class OwnerLogin(BaseModel):
    username: str
    password: str

class Company(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    owner_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CompanyCreate(BaseModel):
    name: str
    admin_username: str
    admin_email: str
    admin_password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    role: str  # "admin" or "user"
    company_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"

class UserLogin(BaseModel):
    username: str
    password: str

class CompanyRegistration(BaseModel):
    company_name: str
    admin_username: str
    admin_email: str
    admin_password: str

class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    surname: str
    position: str
    number: str
    qr_code: str
    company_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EmployeeCreate(BaseModel):
    name: str
    surname: str
    position: str
    number: str

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    position: Optional[str] = None
    number: Optional[str] = None

class TimeEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    date: str  # YYYY-MM-DD format
    status: str  # "working" or "completed"
    last_scan_time: Optional[datetime] = None

class TimeEntryEdit(BaseModel):
    check_in: Optional[str] = None  # HH:MM format
    check_out: Optional[str] = None  # HH:MM format
    date: Optional[str] = None  # YYYY-MM-DD format

class TimeEntryCreate(BaseModel):
    employee_id: str
    check_in: str  # HH:MM format
    check_out: Optional[str] = None  # HH:MM format
    date: str  # YYYY-MM-DD format

class QRScanRequest(BaseModel):
    qr_data: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

# Startup event
@app.on_event("startup")
async def startup_event():
    await init_database()
    # Create default owner if not exists
    await create_default_owner()

# Utility functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generate_qr_code(data: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='PNG')
    img_str = base64.b64encode(img_buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

async def create_default_owner():
    """Create default owner account if not exists"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT id FROM owners WHERE username = ?", ("owner",))
        existing = await cursor.fetchone()
        
        if not existing:
            owner_id = str(uuid.uuid4())
            await db.execute("""
                INSERT INTO owners (id, username, email, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (
                owner_id,
                "owner",
                "owner@system.com",
                get_password_hash("owner123"),
                datetime.utcnow().isoformat()
            ))
            await db.commit()
            print("🎉 Default owner account created: username=owner, password=owner123")

# Authentication functions
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_type: str = payload.get("type", "user")
        
        if username is None:
            raise credentials_exception
            
        if user_type == "owner":
            # Owner authentication
            cursor = await db.execute("SELECT * FROM owners WHERE username = ?", (username,))
            owner_row = await cursor.fetchone()
            if owner_row is None:
                raise credentials_exception
            return {"type": "owner", "data": dict(owner_row)}
        else:
            # Regular user authentication
            company_id: str = payload.get("company_id")
            if company_id is None:
                raise credentials_exception
            cursor = await db.execute("SELECT * FROM users WHERE username = ? AND company_id = ?", (username, company_id))
            user_row = await cursor.fetchone()
            if user_row is None:
                raise credentials_exception
            return {"type": "user", "data": dict(user_row)}
    except jwt.PyJWTError:
        raise credentials_exception

async def get_current_owner(current_auth = Depends(get_current_user)):
    if current_auth["type"] != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required"
        )
    return current_auth["data"]

async def get_current_regular_user(current_auth = Depends(get_current_user)):
    if current_auth["type"] != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regular user access required"
        )
    return current_auth["data"]

async def get_admin_user(current_user = Depends(get_current_regular_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

async def get_company_context(current_user = Depends(get_current_regular_user)):
    """Get company context for filtering data"""
    return current_user["company_id"]

# API Endpoints
@app.get("/api/")
async def root():
    return {"message": "Multi-Tenant Time Tracking System API"}

# Authentication endpoints
@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin, db = Depends(get_db)):
    # First check if user is an owner
    cursor = await db.execute("SELECT * FROM owners WHERE username = ?", (user_data.username,))
    owner_row = await cursor.fetchone()
    
    if owner_row and verify_password(user_data.password, owner_row["password_hash"]):
        # Owner login
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": owner_row["username"],
                "type": "owner"
            }, 
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": owner_row["id"],
                "username": owner_row["username"],
                "email": owner_row["email"],
                "type": "owner"
            }
        }
    
    # If not owner, check regular users
    cursor = await db.execute("SELECT * FROM users WHERE username = ?", (user_data.username,))
    user_row = await cursor.fetchone()
    
    if not user_row or not verify_password(user_data.password, user_row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user_row["username"],
            "company_id": user_row["company_id"],
            "role": user_row["role"],
            "type": "user"
        }, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_row["id"],
            "username": user_row["username"],
            "email": user_row["email"],
            "role": user_row["role"],
            "company_id": user_row["company_id"],
            "type": "user"
        }
    }

@app.get("/api/auth/me")
async def get_me(current_auth = Depends(get_current_user)):
    if current_auth["type"] == "owner":
        owner = current_auth["data"]
        return {
            "id": owner["id"],
            "username": owner["username"],
            "email": owner["email"],
            "type": "owner"
        }
    else:
        user = current_auth["data"]
        return {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "company_id": user["company_id"],
            "type": "user"
        }

@app.post("/api/auth/register-company", response_model=Token)
async def register_company(company_data: CompanyRegistration, db = Depends(get_db)):
    """Allow companies to self-register with admin user"""
    # Check if company name already exists
    cursor = await db.execute("SELECT id FROM companies WHERE name = ?", (company_data.company_name,))
    existing_company = await cursor.fetchone()
    if existing_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firma o tej nazwie już istnieje"
        )
    
    # Check if admin username already exists
    cursor = await db.execute("SELECT id FROM users WHERE username = ?", (company_data.admin_username,))
    existing_user = await cursor.fetchone()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nazwa użytkownika już istnieje"
        )
    
    # Create company
    company_id = str(uuid.uuid4())
    await db.execute("""
        INSERT INTO companies (id, name, owner_id, created_at)
        VALUES (?, ?, ?, ?)
    """, (company_id, company_data.company_name, "system", datetime.utcnow().isoformat()))
    
    # Create admin user
    admin_user_id = str(uuid.uuid4())
    await db.execute("""
        INSERT INTO users (id, username, email, password_hash, role, company_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        admin_user_id,
        company_data.admin_username,
        company_data.admin_email,
        get_password_hash(company_data.admin_password),
        "admin",
        company_id,
        datetime.utcnow().isoformat()
    ))
    
    await db.commit()
    
    # Generate access token for the new admin
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": company_data.admin_username,
            "company_id": company_id,
            "role": "admin",
            "type": "user"
        }, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": admin_user_id,
            "username": company_data.admin_username,
            "email": company_data.admin_email,
            "role": "admin",
            "company_id": company_id,
            "type": "user"
        }
    }

# Company Management (Admin only)
@app.get("/api/company/info")
async def get_company_info(current_user = Depends(get_current_regular_user), db = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM companies WHERE id = ?", (current_user["company_id"],))
    company = await cursor.fetchone()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return dict(company)

@app.get("/api/company/users")
async def get_company_users(current_user = Depends(get_admin_user), db = Depends(get_db)):
    cursor = await db.execute("SELECT id, username, email, role, created_at FROM users WHERE company_id = ?", (current_user["company_id"],))
    users = await cursor.fetchall()
    return [dict(user) for user in users]

@app.post("/api/company/users")
async def create_company_user(user_data: UserCreate, current_user = Depends(get_admin_user), db = Depends(get_db)):
    # Check if username already exists
    cursor = await db.execute("SELECT id FROM users WHERE username = ?", (user_data.username,))
    existing_user = await cursor.fetchone()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nazwa użytkownika już istnieje"
        )
    
    # Create user in the same company as admin
    new_user_id = str(uuid.uuid4())
    await db.execute("""
        INSERT INTO users (id, username, email, password_hash, role, company_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        new_user_id,
        user_data.username,
        user_data.email,
        get_password_hash(user_data.password),
        user_data.role,
        current_user["company_id"],
        datetime.utcnow().isoformat()
    ))
    await db.commit()
    
    return {
        "id": new_user_id,
        "username": user_data.username,
        "email": user_data.email,
        "role": user_data.role,
        "company_id": current_user["company_id"]
    }

@app.delete("/api/company/users/{user_id}")
async def delete_company_user(user_id: str, current_user = Depends(get_admin_user), db = Depends(get_db)):
    # Check if user exists and belongs to the same company
    cursor = await db.execute("SELECT id FROM users WHERE id = ? AND company_id = ?", (user_id, current_user["company_id"]))
    user_to_delete = await cursor.fetchone()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if user_id == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie możesz usunąć własnego konta"
        )
    
    await db.execute("DELETE FROM users WHERE id = ? AND company_id = ?", (user_id, current_user["company_id"]))
    await db.commit()
    
    return {"message": "User deleted successfully"}

# Employee endpoints (Admin only, company-scoped)
@app.post("/api/employees", response_model=Employee)
async def create_employee(employee_data: EmployeeCreate, company_id: str = Depends(get_company_context), current_user = Depends(get_admin_user), db = Depends(get_db)):
    # Check if employee number already exists in this company
    cursor = await db.execute("SELECT id FROM employees WHERE number = ? AND company_id = ?", (employee_data.number, company_id))
    existing_employee = await cursor.fetchone()
    if existing_employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Numer pracownika już istnieje w tej firmie"
        )
    
    # Generate unique QR code data
    qr_data = f"EMP_{company_id}_{employee_data.number}_{str(uuid.uuid4())[:8]}"
    qr_code = generate_qr_code(qr_data)
    
    employee_id = str(uuid.uuid4())
    await db.execute("""
        INSERT INTO employees (id, name, surname, position, number, qr_code, company_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        employee_id,
        employee_data.name,
        employee_data.surname,
        employee_data.position,
        employee_data.number,
        qr_code,
        company_id,
        datetime.utcnow().isoformat()
    ))
    await db.commit()
    
    return Employee(
        id=employee_id,
        name=employee_data.name,
        surname=employee_data.surname,
        position=employee_data.position,
        number=employee_data.number,
        qr_code=qr_code,
        company_id=company_id
    )

@app.get("/api/employees", response_model=List[Employee])
async def get_employees(company_id: str = Depends(get_company_context), current_user = Depends(get_admin_user), db = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM employees WHERE company_id = ?", (company_id,))
    employees = await cursor.fetchall()
    return [Employee(**dict(emp)) for emp in employees]

@app.put("/api/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, employee_data: EmployeeUpdate, company_id: str = Depends(get_company_context), current_user = Depends(get_admin_user), db = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM employees WHERE id = ? AND company_id = ?", (employee_id, company_id))
    employee = await cursor.fetchone()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Build update query dynamically based on provided fields
    update_fields = []
    update_values = []
    
    if employee_data.name is not None:
        update_fields.append("name = ?")
        update_values.append(employee_data.name)
    if employee_data.surname is not None:
        update_fields.append("surname = ?")
        update_values.append(employee_data.surname)
    if employee_data.position is not None:
        update_fields.append("position = ?")
        update_values.append(employee_data.position)
    if employee_data.number is not None:
        # Check if number already exists
        cursor = await db.execute("SELECT id FROM employees WHERE number = ? AND company_id = ? AND id != ?", (employee_data.number, company_id, employee_id))
        existing = await cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Numer pracownika już istnieje w tej firmie"
            )
        update_fields.append("number = ?")
        update_values.append(employee_data.number)
    
    if update_fields:
        update_values.extend([employee_id, company_id])
        await db.execute(f"UPDATE employees SET {', '.join(update_fields)} WHERE id = ? AND company_id = ?", update_values)
        await db.commit()
    
    cursor = await db.execute("SELECT * FROM employees WHERE id = ? AND company_id = ?", (employee_id, company_id))
    updated_employee = await cursor.fetchone()
    return Employee(**dict(updated_employee))

@app.delete("/api/employees/{employee_id}")
async def delete_employee(employee_id: str, company_id: str = Depends(get_company_context), current_user = Depends(get_admin_user), db = Depends(get_db)):
    await db.execute("DELETE FROM employees WHERE id = ? AND company_id = ?", (employee_id, company_id))
    # Also delete related time entries
    await db.execute("DELETE FROM time_entries WHERE employee_id = ?", (employee_id,))
    await db.commit()
    
    return {"message": "Employee deleted successfully"}

# Time tracking endpoints (company-scoped)
@app.post("/api/time/scan")
async def scan_qr(scan_data: QRScanRequest, company_id: str = Depends(get_company_context), current_user = Depends(get_current_regular_user), db = Depends(get_db)):
    # Find employee by QR data
    qr_data = scan_data.qr_data
    
    # Extract company and employee info from QR data (format: EMP_COMPANYID_NUMBER_UUID)
    if not qr_data.startswith("EMP_"):
        raise HTTPException(status_code=400, detail="Invalid QR code")
    
    try:
        parts = qr_data.split("_")
        if len(parts) < 3:
            raise HTTPException(status_code=400, detail="Invalid QR code format")
        qr_company_id = parts[1]
        employee_number = parts[2]
        
        # Verify QR code belongs to user's company
        if qr_company_id != company_id:
            raise HTTPException(status_code=403, detail="QR kod nie należy do Twojej firmy")
        
        cursor = await db.execute("SELECT * FROM employees WHERE number = ? AND company_id = ?", (employee_number, company_id))
        employee = await cursor.fetchone()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        employee = dict(employee)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid QR code format")
    
    today = datetime.now().strftime("%Y-%m-%d")
    current_time = datetime.now()
    
    # Check if there's an active time entry for today
    cursor = await db.execute("SELECT * FROM time_entries WHERE employee_id = ? AND date = ? AND status = ?", (employee["id"], today, "working"))
    existing_entry = await cursor.fetchone()
    
    # Cooldown check - prevent scanning within 5 seconds
    COOLDOWN_SECONDS = 5
    
    if existing_entry:
        existing_entry = dict(existing_entry)
        if existing_entry.get("last_scan_time"):
            last_scan = datetime.fromisoformat(existing_entry["last_scan_time"])
            time_diff = (current_time - last_scan).total_seconds()
            if time_diff < COOLDOWN_SECONDS:
                remaining_seconds = int(COOLDOWN_SECONDS - time_diff)
                raise HTTPException(
                    status_code=429, 
                    detail=f"Poczekaj {remaining_seconds} sekund przed kolejnym skanowaniem"
                )
        
        # Check out - end work
        check_out_time = datetime.now()
        await db.execute("""
            UPDATE time_entries 
            SET check_out = ?, status = ?, last_scan_time = ?
            WHERE id = ?
        """, (check_out_time.isoformat(), "completed", check_out_time.isoformat(), existing_entry["id"]))
        await db.commit()
        
        return {
            "action": "check_out",
            "employee": f"{employee['name']} {employee['surname']}",
            "time": check_out_time.strftime("%H:%M:%S"),
            "message": "Pomyślnie zakończono pracę",
            "cooldown_seconds": COOLDOWN_SECONDS
        }
    else:
        # Check in - start work
        check_in_time = datetime.now()
        entry_id = str(uuid.uuid4())
        await db.execute("""
            INSERT INTO time_entries (id, employee_id, check_in, date, status, last_scan_time)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (entry_id, employee["id"], check_in_time.isoformat(), today, "working", check_in_time.isoformat()))
        await db.commit()
        
        return {
            "action": "check_in",
            "employee": f"{employee['name']} {employee['surname']}",
            "time": check_in_time.strftime("%H:%M:%S"),
            "message": "Pomyślnie rozpoczęto pracę",
            "cooldown_seconds": COOLDOWN_SECONDS
        }

@app.get("/api/time/entries")
async def get_all_time_entries(company_id: str = Depends(get_company_context), current_user = Depends(get_admin_user), db = Depends(get_db)):
    """Get all time entries for company with employee information"""
    cursor = await db.execute("""
        SELECT te.*, e.name, e.surname, e.number, e.position
        FROM time_entries te
        JOIN employees e ON te.employee_id = e.id
        WHERE e.company_id = ?
        ORDER BY te.date DESC
    """, (company_id,))
    entries = await cursor.fetchall()
    
    result = []
    for entry in entries:
        entry_dict = dict(entry)
        entry_dict["employee_name"] = f"{entry['name']} {entry['surname']}"
        entry_dict["employee_number"] = entry["number"]
        entry_dict["employee_position"] = entry["position"]
        
        # Calculate hours worked if both check_in and check_out exist
        if entry_dict.get("check_in") and entry_dict.get("check_out"):
            check_in = datetime.fromisoformat(entry_dict["check_in"])
            check_out = datetime.fromisoformat(entry_dict["check_out"])
            duration = check_out - check_in
            hours_worked = duration.total_seconds() / 3600
            entry_dict["hours_worked"] = round(hours_worked, 2)
        else:
            entry_dict["hours_worked"] = None
        
        result.append(entry_dict)
    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)