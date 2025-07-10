# Continuation of server_mysql.py - Authentication and CRUD operations

from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import selectinload

# Authentication helper functions
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_database_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_type: str = payload.get("type", "user")  # "user" or "owner"
        
        if username is None:
            raise credentials_exception
            
        if user_type == "owner":
            # Owner authentication
            result = await db.execute(select(OwnerTable).where(OwnerTable.username == username))
            owner_row = result.scalar_one_or_none()
            if owner_row is None:
                raise credentials_exception
            owner = Owner(
                id=owner_row.id,
                username=owner_row.username,
                email=owner_row.email,
                password_hash=owner_row.password_hash,
                created_at=owner_row.created_at
            )
            return {"type": "owner", "data": owner}
        else:
            # Regular user authentication
            company_id: str = payload.get("company_id")
            if company_id is None:
                raise credentials_exception
            result = await db.execute(select(UserTable).where(UserTable.username == username, UserTable.company_id == company_id))
            user_row = result.scalar_one_or_none()
            if user_row is None:
                raise credentials_exception
            user = User(
                id=user_row.id,
                username=user_row.username,
                email=user_row.email,
                password_hash=user_row.password_hash,
                role=user_row.role,
                company_id=user_row.company_id,
                created_at=user_row.created_at
            )
            return {"type": "user", "data": user}
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

async def get_admin_user(current_user: User = Depends(get_current_regular_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

async def get_company_context(current_user: User = Depends(get_current_regular_user)):
    """Get company context for filtering data"""
    return current_user.company_id

# Owner Authentication and Management
@app.post("/api/owner/login", response_model=Token)
async def owner_login(login_data: OwnerLogin, db: AsyncSession = Depends(get_database_session)):
    result = await db.execute(select(OwnerTable).where(OwnerTable.username == login_data.username))
    owner_row = result.scalar_one_or_none()
    
    if not owner_row or not verify_password(login_data.password, owner_row.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": owner_row.username,
            "type": "owner"
        }, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": owner_row.id,
            "username": owner_row.username,
            "email": owner_row.email,
            "type": "owner"
        }
    }

@app.get("/api/owner/companies")
async def get_all_companies(current_owner: Owner = Depends(get_current_owner), db: AsyncSession = Depends(get_database_session)):
    """Get all companies (owner only)"""
    result = await db.execute(select(CompanyTable))
    companies = result.scalars().all()
    result_list = []
    
    for company in companies:
        # Get company admin count
        admin_count_result = await db.execute(
            select(func.count()).select_from(UserTable).where(
                UserTable.company_id == company.id,
                UserTable.role == "admin"
            )
        )
        admin_count = admin_count_result.scalar()
        
        # Get total user count
        user_count_result = await db.execute(
            select(func.count()).select_from(UserTable).where(UserTable.company_id == company.id)
        )
        user_count = user_count_result.scalar()
        
        # Get employee count
        employee_count_result = await db.execute(
            select(func.count()).select_from(EmployeeTable).where(EmployeeTable.company_id == company.id)
        )
        employee_count = employee_count_result.scalar()
        
        company_data = {
            "id": company.id,
            "name": company.name,
            "owner_id": company.owner_id,
            "created_at": company.created_at,
            "admin_count": admin_count,
            "user_count": user_count,
            "employee_count": employee_count
        }
        result_list.append(company_data)
    
    return result_list

@app.post("/api/owner/companies")
async def create_company(
    company_data: CompanyCreate,
    current_owner: Owner = Depends(get_current_owner),
    db: AsyncSession = Depends(get_database_session)
):
    """Create a new company with admin user (owner only)"""
    # Check if company name already exists
    existing_company_result = await db.execute(select(CompanyTable).where(CompanyTable.name == company_data.name))
    existing_company = existing_company_result.scalar_one_or_none()
    if existing_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firma o tej nazwie już istnieje"
        )
    
    # Check if admin username already exists
    existing_user_result = await db.execute(select(UserTable).where(UserTable.username == company_data.admin_username))
    existing_user = existing_user_result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nazwa użytkownika już istnieje"
        )
    
    # Create company
    company_id = str(uuid.uuid4())
    new_company = CompanyTable(
        id=company_id,
        name=company_data.name,
        owner_id=current_owner.id
    )
    db.add(new_company)
    
    # Create admin user
    admin_user_id = str(uuid.uuid4())
    admin_user = UserTable(
        id=admin_user_id,
        username=company_data.admin_username,
        email=company_data.admin_email,
        password_hash=get_password_hash(company_data.admin_password),
        role="admin",
        company_id=company_id
    )
    db.add(admin_user)
    await db.commit()
    
    return {
        "message": "Company created successfully",
        "company": {
            "id": company_id,
            "name": company_data.name,
            "owner_id": current_owner.id,
            "created_at": new_company.created_at
        },
        "admin_user": {
            "id": admin_user_id,
            "username": company_data.admin_username,
            "email": company_data.admin_email,
            "role": "admin"
        }
    }

@app.delete("/api/owner/companies/{company_id}")
async def delete_company(
    company_id: str,
    current_owner: Owner = Depends(get_current_owner),
    db: AsyncSession = Depends(get_database_session)
):
    """Delete a company and all its data (owner only)"""
    # Check if company exists
    company_result = await db.execute(select(CompanyTable).where(CompanyTable.id == company_id))
    company = company_result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get all employee IDs first, then delete time entries
    employees_result = await db.execute(select(EmployeeTable.id).where(EmployeeTable.company_id == company_id))
    employee_ids = [emp[0] for emp in employees_result.fetchall()]
    
    if employee_ids:
        await db.execute(delete(TimeEntryTable).where(TimeEntryTable.employee_id.in_(employee_ids)))
    
    # Delete all company data
    await db.execute(delete(UserTable).where(UserTable.company_id == company_id))
    await db.execute(delete(EmployeeTable).where(EmployeeTable.company_id == company_id))
    await db.execute(delete(CompanyTable).where(CompanyTable.id == company_id))
    
    await db.commit()
    
    return {"message": "Company and all its data deleted successfully"}

@app.get("/api/")
async def root():
    return {"message": "Multi-Tenant Time Tracking System API"}