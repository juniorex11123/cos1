import React, { useState, useEffect } from 'react';
import EmployeeForm from './EmployeeForm';
import EmployeeList from './EmployeeList';
import TimeReports from './TimeReports';
import UserManagement from './UserManagement';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function AdminDashboard({ user, onLogout }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employees');
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch employees and company info
      const [employeesResponse, companyResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/employees`, { headers }),
        fetch(`${BACKEND_URL}/api/company/info`, { headers })
      ]);
      
      if (employeesResponse.ok && companyResponse.ok) {
        const [employeesData, companyData] = await Promise.all([
          employeesResponse.json(),
          companyResponse.json()
        ]);
        setEmployees(employeesData);
        setCompanyInfo(companyData);
      }
    } catch (error) {
      console.error('Błąd pobierania danych:', error);
    }
    setLoading(false);
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/employees`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Błąd pobierania pracowników:', error);
    }
  };

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setShowForm(true);
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tego pracownika?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/employees/${employeeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setEmployees(employees.filter(emp => emp.id !== employeeId));
      }
    } catch (error) {
      console.error('Błąd usuwania pracownika:', error);
    }
  };

  const handleFormSubmit = async (employeeData) => {
    try {
      const token = localStorage.getItem('token');
      const url = editingEmployee 
        ? `${BACKEND_URL}/api/employees/${editingEmployee.id}`
        : `${BACKEND_URL}/api/employees`;
      
      const method = editingEmployee ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(employeeData)
      });

      if (response.ok) {
        await fetchEmployees();
        setShowForm(false);
        setEditingEmployee(null);
      }
    } catch (error) {
      console.error('Błąd zapisywania pracownika:', error);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEmployee(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Panel Administratora</h1>
              <div className="text-gray-600 space-y-1">
                <p>Witaj, {user.username}</p>
                {companyInfo && (
                  <p className="text-sm">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      🏢 {companyInfo.name}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onLogout}
              className="text-red-600 hover:text-red-800 font-medium"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('employees')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'employees'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Zarządzanie Pracownikami
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Raporty Czasu Pracy
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Zarządzanie Użytkownikami
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {activeTab === 'employees' && (
          <div>
            {showForm ? (
              <EmployeeForm
                employee={editingEmployee}
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
              />
            ) : (
              <EmployeeList
                employees={employees}
                onAdd={handleAddEmployee}
                onEdit={handleEditEmployee}
                onDelete={handleDeleteEmployee}
              />
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <TimeReports />
        )}

        {activeTab === 'users' && (
          <UserManagement />
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;