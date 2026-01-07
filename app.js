/*
 * Hauptlogik der Einnahmen‑PWA.
 * Diese Datei verwaltet das Hinzufügen, Anzeigen, Filtern und Exportieren von Einnahme‑Einträgen
 * sowie das Speichern von Einstellungen (Steuersatz, bereits abgeführte Steuern).
 */

// Schlüsselnamen für LocalStorage
const STORAGE_KEY_RECORDS = 'income_records';
const STORAGE_KEY_SETTINGS = 'income_settings';

// Globale Variablen für geladenen Zustand
let records = [];
let settings = { taxRate: 0, taxPaid: 0 };

// Utility: Daten laden
function loadData() {
  const recStr = localStorage.getItem(STORAGE_KEY_RECORDS);
  records = recStr ? JSON.parse(recStr) : [];
  const setStr = localStorage.getItem(STORAGE_KEY_SETTINGS);
  settings = setStr
    ? JSON.parse(setStr)
    : { taxRate: 0, taxPaid: 0 };
}

// Utility: Daten speichern
function saveData() {
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

// Daten formatieren (Datum & Euro)
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

// Tabelle aktualisieren
function updateTable() {
  const tbody = document.getElementById('recordTableBody');
  tbody.innerHTML = '';
  const filtered = getFilteredRecords();
  // sortiere nach Datum absteigend
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  filtered.forEach((rec, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(rec.date)}</td>
      <td>${rec.facility}</td>
      <td>${rec.hours}</td>
      <td>${formatCurrency(rec.rate)}</td>
      <td>${formatCurrency(rec.income)}</td>
      <td><button data-index="${rec.id}" class="deleteBtn">Löschen</button></td>
    `;
    tbody.appendChild(tr);
  });
  updateSummary(filtered);
  // Eventlistener für Löschen
  document.querySelectorAll('.deleteBtn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-index');
      deleteRecord(id);
    });
  });
}

// Zusammenfassung aktualisieren
function updateSummary(list) {
  const summaryDiv = document.getElementById('summaryContent');
  const totalIncome = list.reduce((sum, r) => sum + r.income, 0);
  const taxRate = settings.taxRate || 0;
  const taxAmount = totalIncome * (taxRate / 100);
  const netIncome = totalIncome - taxAmount;
  const openTax = taxAmount - (settings.taxPaid || 0);
  let openLabel = '';
  let openValue = 0;
  if (openTax > 0) {
    openLabel = 'Offene Steuer';
    openValue = openTax;
  } else if (openTax < 0) {
    openLabel = 'Überzahlung';
    openValue = Math.abs(openTax);
  } else {
    openLabel = 'Ausgeglichen';
    openValue = 0;
  }
  summaryDiv.innerHTML = `
    <p><strong>Gesamt-Einnahmen:</strong> ${formatCurrency(totalIncome)}</p>
    <p><strong>Steuersatz:</strong> ${taxRate}%</p>
    <p><strong>Steuerbetrag:</strong> ${formatCurrency(taxAmount)}</p>
    <p><strong>Bereits abgeführte Steuern:</strong> ${formatCurrency(settings.taxPaid || 0)}</p>
    <p><strong>${openLabel}:</strong> ${formatCurrency(openValue)}</p>
    <p><strong>Netto nach Steuern:</strong> ${formatCurrency(netIncome)}</p>
  `;
}

// Filter anwenden
function getFilteredRecords() {
  const monthSel = document.getElementById('monthFilter').value;
  const yearSel = document.getElementById('yearFilter').value;
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;
  return records.filter((rec) => {
    const date = new Date(rec.date);
    let ok = true;
    if (monthSel !== 'all') {
      ok = ok && date.getMonth() + 1 === parseInt(monthSel);
    }
    if (yearSel !== 'all') {
      ok = ok && date.getFullYear() === parseInt(yearSel);
    }
    if (fromDate) {
      ok = ok && date >= new Date(fromDate);
    }
    if (toDate) {
      const to = new Date(toDate);
      // inclusive end date
      to.setHours(23, 59, 59, 999);
      ok = ok && date <= to;
    }
    return ok;
  });
}

// Delete record by id
function deleteRecord(id) {
  records = records.filter((rec) => rec.id !== id);
  saveData();
  updateTable();
}

// Record hinzufügen
function addRecord(rec) {
  records.push(rec);
  saveData();
  updateTable();
  populateFilters();
}

// Filteroptionen befüllen (Monat/Jahr)
function populateFilters() {
  const monthSelect = document.getElementById('monthFilter');
  const yearSelect = document.getElementById('yearFilter');
  // Monate 1–12
  const monthNames = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ];
  // Nur einmal füllen, falls leer
  if (monthSelect.options.length <= 1) {
    monthNames.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = idx + 1;
      opt.textContent = name;
      monthSelect.appendChild(opt);
    });
  }
  // Jahre basierend auf Records
  const years = new Set(records.map((r) => new Date(r.date).getFullYear()));
  // Clear existing except 'all'
  yearSelect.innerHTML = '<option value="all">Alle</option>';
  [...years]
    .sort((a, b) => b - a)
    .forEach((yr) => {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = yr;
      yearSelect.appendChild(opt);
    });
}

// CSV Export
function exportToCsv() {
  const filtered = getFilteredRecords();
  if (filtered.length === 0) {
    alert('Keine Einträge für Export verfügbar.');
    return;
  }
  const header = ['Datum', 'Einrichtung', 'Stunden', 'Stundensatz', 'Einnahmen'];
  const rows = filtered.map((rec) => [
    formatDate(rec.date),
    rec.facility,
    rec.hours,
    rec.rate,
    rec.income,
  ]);
  let csvContent = header.join(',') + '\n';
  rows.forEach((row) => {
    csvContent += row.join(',') + '\n';
  });
  // Summenblock am Ende
  const totalIncome = filtered.reduce((sum, r) => sum + r.income, 0);
  const taxRate = settings.taxRate || 0;
  const taxAmount = totalIncome * (taxRate / 100);
  const netIncome = totalIncome - taxAmount;
  csvContent += '\n';
  csvContent += `Gesamt Einnahmen:,${totalIncome}\n`;
  csvContent += `Steuersatz:,${taxRate}%\n`;
  csvContent += `Steuerbetrag:,${taxAmount}\n`;
  csvContent += `Bereits abgeführte Steuern:,${settings.taxPaid || 0}\n`;
  const openTax = taxAmount - (settings.taxPaid || 0);
  let openLabel = '';
  let openValue = 0;
  if (openTax > 0) {
    openLabel = 'Offene Steuer';
    openValue = openTax;
  } else if (openTax < 0) {
    openLabel = 'Überzahlung';
    openValue = Math.abs(openTax);
  } else {
    openLabel = 'Ausgeglichen';
    openValue = 0;
  }
  csvContent += `${openLabel}:,${openValue}\n`;
  csvContent += `Netto nach Steuern:,${netIncome}\n`;
  // Download-Link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date();
  const fileName = `einnahmen_${date.getFullYear()}${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')} ${date
    .getDate()
    .toString()
    .padStart(2, '0')}.csv`;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Initialisierung bei DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  populateFilters();
  // Form-Submit-Handler
  const form = document.getElementById('recordForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('dateInput').value;
    const facility = document.getElementById('facilityInput').value.trim();
    const hours = parseFloat(document.getElementById('hoursInput').value);
    const rate = parseFloat(document.getElementById('rateInput').value);
    if (!date || !facility || isNaN(hours) || isNaN(rate)) {
      alert('Bitte alle Felder korrekt ausfüllen.');
      return;
    }
    const income = hours * rate;
    const id = Date.now().toString();
    addRecord({ id, date, facility, hours, rate, income });
    // Form zurücksetzen
    form.reset();
  });
  // Filter-Anwendung
  document.getElementById('applyFilter').addEventListener('click', () => {
    updateTable();
  });
  // Export-CSV
  document.getElementById('exportCsv').addEventListener('click', exportToCsv);
  // Einstellungen laden und speichern
  document.getElementById('taxRateInput').value = settings.taxRate;
  document.getElementById('taxPaidInput').value = settings.taxPaid;
  document.getElementById('saveSettings').addEventListener('click', () => {
    const taxRateVal = parseFloat(document.getElementById('taxRateInput').value);
    const taxPaidVal = parseFloat(document.getElementById('taxPaidInput').value);
    settings.taxRate = isNaN(taxRateVal) ? 0 : taxRateVal;
    settings.taxPaid = isNaN(taxPaidVal) ? 0 : taxPaidVal;
    saveData();
    updateTable();
    alert('Einstellungen gespeichert');
  });
  // Initiales Rendering
  updateTable();
});