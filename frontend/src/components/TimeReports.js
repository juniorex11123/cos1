import React, { useState, useEffect } from 'react';
import TimeEntryForm from './TimeEntryForm';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function TimeReports() {
  const [timeEntries, setTimeEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [filters, setFilters] = useState({
    employee: '',
    dateFrom: '',
    dateTo: '',
    status: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch time entries and employees in parallel
      const [entriesResponse, employeesResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/time/entries`, { headers }),
        fetch(`${BACKEND_URL}/api/employees`, { headers })
      ]);

      if (entriesResponse.ok && employeesResponse.ok) {
        const [entriesData, employeesData] = await Promise.all([
          entriesResponse.json(),
          employeesResponse.json()
        ]);
        
        setTimeEntries(entriesData);
        setEmployees(employeesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleAddEntry = () => {
    setEditingEntry(null);
    setShowForm(true);
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten wpis?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/time/entries/${entryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const handleFormSubmit = async (entryData) => {
    try {
      const token = localStorage.getItem('token');
      const url = editingEntry 
        ? `${BACKEND_URL}/api/time/entries/${editingEntry.id}`
        : `${BACKEND_URL}/api/time/entries`;
      
      const method = editingEntry ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(entryData)
      });

      if (response.ok) {
        await fetchData();
        setShowForm(false);
        setEditingEntry(null);
      }
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('pl-PL', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return timeString;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pl-PL');
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    
    if (status === 'completed') {
      return (
        <span className={`${baseClasses} bg-green-100 text-green-800`}>
          Zakończone
        </span>
      );
    } else if (status === 'working') {
      return (
        <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
          W trakcie
        </span>
      );
    }
    
    return (
      <span className={`${baseClasses} bg-gray-100 text-gray-800`}>
        {status}
      </span>
    );
  };

  const filteredEntries = timeEntries.filter(entry => {
    if (filters.employee && entry.employee_id !== filters.employee) return false;
    if (filters.status && entry.status !== filters.status) return false;
    if (filters.dateFrom && entry.date < filters.dateFrom) return false;
    if (filters.dateTo && entry.date > filters.dateTo) return false;
    return true;
  });

  const totalHours = filteredEntries
    .filter(entry => entry.hours_worked)
    .reduce((sum, entry) => sum + entry.hours_worked, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xl">Ładowanie...</div>
      </div>
    );
  }

  if (showForm) {
    return (
      <TimeEntryForm
        entry={editingEntry}
        employees={employees}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Raporty Czasu Pracy</h2>
          <p className="text-gray-600">
            Łącznie {filteredEntries.length} wpisów • {totalHours.toFixed(2)} godzin
          </p>
        </div>
        <button
          onClick={handleAddEntry}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Dodaj Wpis
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Filtry</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pracownik
            </label>
            <select
              value={filters.employee}
              onChange={(e) => setFilters({...filters, employee: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Wszyscy pracownicy</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.surname}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data od
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data do
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Wszystkie statusy</option>
              <option value="working">W trakcie</option>
              <option value="completed">Zakończone</option>
            </select>
          </div>
        </div>

        {(filters.employee || filters.dateFrom || filters.dateTo || filters.status) && (
          <div className="mt-4">
            <button
              onClick={() => setFilters({ employee: '', dateFrom: '', dateTo: '', status: '' })}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Wyczyść filtry
            </button>
          </div>
        )}
      </div>

      {/* Time Entries Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Brak wpisów</h3>
            <p className="text-gray-600 mb-4">
              Nie znaleziono wpisów czasu pracy dla wybranych filtrów
            </p>
            <button
              onClick={handleAddEntry}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Dodaj pierwszy wpis
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pracownik
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rozpoczęcie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zakończenie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Godziny
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {entry.employee_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {entry.employee_number} • {entry.employee_position}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(entry.check_in)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(entry.check_out)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.hours_worked ? `${entry.hours_worked}h` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(entry.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEditEntry(entry)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edytuj
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default TimeReports;