import React, { useState } from 'react';

function TimeEntryForm({ entry, employees, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    employee_id: entry?.employee_id || '',
    date: entry?.date || new Date().toISOString().split('T')[0],
    check_in: entry?.check_in ? 
      new Date(entry.check_in).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false }) : 
      '',
    check_out: entry?.check_out ? 
      new Date(entry.check_out).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false }) : 
      ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validate times
    if (formData.check_out && formData.check_in) {
      const checkIn = new Date(`1970-01-01T${formData.check_in}:00`);
      const checkOut = new Date(`1970-01-01T${formData.check_out}:00`);
      
      if (checkOut <= checkIn) {
        alert('Czas zakończenia musi być późniejszy niż czas rozpoczęcia');
        setLoading(false);
        return;
      }
    }

    // Prepare data for submission
    const submitData = {
      ...formData,
      check_out: formData.check_out || null
    };

    await onSubmit(submitData);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          {entry ? 'Edytuj Wpis Czasu Pracy' : 'Dodaj Wpis Czasu Pracy'}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 mb-2">
              Pracownik *
            </label>
            <select
              id="employee_id"
              name="employee_id"
              value={formData.employee_id}
              onChange={handleChange}
              required
              disabled={!!entry} // Disable editing employee in edit mode
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Wybierz pracownika</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.surname} - {emp.number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              Data *
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="check_in" className="block text-sm font-medium text-gray-700 mb-2">
              Rozpoczęcie pracy *
            </label>
            <input
              type="time"
              id="check_in"
              name="check_in"
              value={formData.check_in}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="check_out" className="block text-sm font-medium text-gray-700 mb-2">
              Zakończenie pracy
            </label>
            <input
              type="time"
              id="check_out"
              name="check_out"
              value={formData.check_out}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              Opcjonalne - pozostaw puste jeśli praca jest w trakcie
            </p>
          </div>
        </div>

        {/* Time Summary */}
        {formData.check_in && formData.check_out && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Podsumowanie</h3>
            <div className="text-sm text-blue-700">
              {(() => {
                try {
                  const checkIn = new Date(`1970-01-01T${formData.check_in}:00`);
                  const checkOut = new Date(`1970-01-01T${formData.check_out}:00`);
                  const diffMs = checkOut - checkIn;
                  const diffHours = diffMs / (1000 * 60 * 60);
                  
                  if (diffHours > 0) {
                    return `Czas pracy: ${diffHours.toFixed(2)} godzin`;
                  } else {
                    return 'Nieprawidłowy zakres czasu';
                  }
                } catch {
                  return 'Błąd obliczania czasu';
                }
              })()}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Zapisywanie...' : (entry ? 'Aktualizuj' : 'Dodaj')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TimeEntryForm;