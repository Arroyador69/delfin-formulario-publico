/**
 * Viajeros dinámicos según max_guests (query param desde admin).
 * Límite MIR: 50 personas por comunicación.
 */
(function () {
  'use strict';

  var MIR_MAX = 50;
  var DEFAULT_MAX = 2;

  function clampMax(raw) {
    var n = parseInt(String(raw || ''), 10);
    if (!isFinite(n)) return DEFAULT_MAX;
    return Math.max(1, Math.min(MIR_MAX, n));
  }

  function getMaxGuests() {
    try {
      var p = new URLSearchParams(window.location.search);
      return clampMax(p.get('max_guests'));
    } catch (e) {
      return DEFAULT_MAX;
    }
  }

  function t(key, vars) {
    var dict = (window.I18N && window.I18N[window.currentLang || 'es']) || {};
    var s = dict[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace('{' + k + '}', String(vars[k]));
      });
    }
    return s;
  }

  function fieldName(base, index) {
    if (index === 1) return base;
    if (base === 'apellido1') return 'apellido1_' + index;
    if (base === 'apellido2') return 'apellido2_' + index;
    return base + index;
  }

  function getActiveIndices() {
    var max = getMaxGuests();
    var indices = [1];
    var t2 = document.getElementById('traveler2Section');
    if (t2 && !t2.classList.contains('hidden')) indices.push(2);
    var extra = document.querySelectorAll('[data-dynamic-traveler]');
    extra.forEach(function (el) {
      var idx = parseInt(el.getAttribute('data-dynamic-traveler'), 10);
      if (idx >= 3 && idx <= max && indices.indexOf(idx) === -1) indices.push(idx);
    });
    indices.sort(function (a, b) { return a - b; });
    return indices;
  }

  function countVisible() {
    return getActiveIndices().length;
  }

  function updateAddButton() {
    var btn = document.getElementById('addTraveler2');
    if (!btn) return;
    var visible = countVisible();
    var max = getMaxGuests();
    if (visible >= max) {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'inline-flex';
    }
    var hint = document.getElementById('travelersCapacityHint');
    if (hint) {
      hint.textContent = t('travelers.capacityHint', { max: max, current: visible });
      hint.classList.remove('hidden');
    }
  }

  function bindCountrySelects(root) {
    if (typeof populateCountrySelects === 'function') {
      setTimeout(function () {
        populateCountrySelects(document.documentElement.lang || 'es', root);
      }, 50);
    }
  }

  function buildTravelerSectionHtml(index) {
    var title = t('travelers.travelerN', { n: index });
    return (
      '<div class="border rounded-lg p-6 mb-4 bg-gray-50" data-dynamic-traveler="' + index + '" id="travelerSection' + index + '">' +
      '<div class="flex justify-between items-center mb-4">' +
      '<h4 class="font-medium text-gray-900">' + title + '</h4>' +
      '<button type="button" class="text-red-600 hover:text-red-800 text-sm dyn-remove-traveler" data-index="' + index + '">' +
      t('travelers.remove') + '</button></div>' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
      inputField('nombre', index, t('travelers.firstName'), true) +
      inputField('apellido1', index, t('travelers.firstSurname'), true) +
      inputField('apellido2', index, t('travelers.secondSurname'), false) +
      dateField('fechaNacimiento', index, t('travelers.birthDate')) +
      selectDoc(index) +
      inputField('numeroDocumento', index, t('travelers.documentNumber'), true) +
      inputField('soporteDocumento', index, t('travelers.documentSupportDni'), false) +
      selectField('sexo', index, t('travelers.gender')) +
      nationalitySelect(index) +
      inputField('telefono', index, t('travelers.phone'), true) +
      inputField('correo', index, t('travelers.email'), true) +
      inputField('direccion', index, t('travelers.address'), true) +
      inputField('codigoPostal', index, t('travelers.postalCode'), true) +
      countrySelect(index) +
      '<div class="relative"><label class="block text-sm font-medium text-gray-700 mb-2">' + t('travelers.municipalityCode') + '</label>' +
      '<input type="text" name="' + fieldName('codigoMunicipio', index) + '" id="codigoMunicipio' + index + '" class="form-input" readonly />' +
      '<input type="text" id="municipioSearch' + index + '" class="form-input mt-2" autocomplete="off" />' +
      '<div id="municipioResults' + index + '" class="absolute z-10 w-full bg-white border rounded-md shadow-lg hidden max-h-48 overflow-y-auto"></div></div>' +
      inputField('nombreMunicipio', index, t('travelers.municipalityName'), false) +
      '</div></div>'
    );
  }

  function inputField(base, index, label, required) {
    var name = fieldName(base, index);
    var req = required ? ' required' : '';
    return '<div><label class="block text-sm font-medium text-gray-700 mb-2">' + label + '</label>' +
      '<input type="text" name="' + name + '" class="form-input"' + req + ' /></div>';
  }

  function dateField(base, index, label) {
    var name = fieldName(base, index);
    return '<div><label class="block text-sm font-medium text-gray-700 mb-2">' + label + '</label>' +
      '<input type="date" name="' + name + '" class="form-input" required /></div>';
  }

  function selectDoc(index) {
    var name = fieldName('tipoDocumento', index);
    return '<div><label class="block text-sm font-medium text-gray-700 mb-2">' + t('travelers.documentType') + '</label>' +
      '<select name="' + name + '" class="form-input" required>' +
      '<option value="NIF">DNI</option><option value="NIE">NIE</option><option value="PAS" selected>Pasaporte</option><option value="OTRO">Otro</option></select></div>';
  }

  function selectField(base, index, label) {
    var name = fieldName(base, index);
    return '<div><label class="block text-sm font-medium text-gray-700 mb-2">' + label + '</label>' +
      '<select name="' + name + '" class="form-input" required>' +
      '<option value="H">Hombre</option><option value="M">Mujer</option><option value="O">Otro</option></select></div>';
  }

  function nationalitySelect(index) {
    var name = fieldName('nacionalidad', index);
    return '<div><label class="block text-sm font-medium text-gray-700 mb-2">' + t('travelers.nationality') + '</label>' +
      '<select name="' + name + '" class="form-input nationality-select" required><option value="">—</option></select></div>';
  }

  function countrySelect(index) {
    var name = fieldName('pais', index);
    return '<div><label class="block text-sm font-medium text-gray-700 mb-2">' + t('travelers.country') + '</label>' +
      '<select name="' + name + '" class="form-input country-select" required><option value="">—</option></select></div>';
  }

  function buildSignatureHtml(index) {
    return (
      '<div class="dyn-signature-block" data-signature-index="' + index + '" id="signatureBlock' + index + '">' +
      '<p class="text-sm font-medium text-gray-700 mb-2">' + t('travelers.signatureN', { n: index }) + '</p>' +
      '<div id="signaturePadWrapper' + index + '" class="signature-pad-wrapper">' +
      '<canvas id="signatureCanvas' + index + '"></canvas>' +
      '<div class="signature-placeholder"><span>' + t('signature.placeholder') + '</span></div></div>' +
      '<div class="flex justify-end mt-2">' +
      '<button type="button" class="text-xs text-gray-500 dyn-clear-sig" data-index="' + index + '">' + t('signature.clear') + '</button></div></div>'
    );
  }

  var signaturePads = {};

  function initSignatureForIndex(index) {
    if (typeof SignaturePad === 'undefined') return;
    var canvas = document.getElementById('signatureCanvas' + index);
    var wrapper = document.getElementById('signaturePadWrapper' + index);
    if (!canvas || !wrapper || signaturePads[index]) return;
    var pad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 0.5,
      maxWidth: 2.5,
    });
    pad.addEventListener('beginStroke', function () {
      wrapper.classList.add('has-signature');
    });
    signaturePads[index] = pad;
    setTimeout(function () {
      var ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      pad.clear();
    }, 80);
  }

  function addTraveler() {
    var visible = countVisible();
    var max = getMaxGuests();
    if (visible >= max) return;

    if (visible === 1 && typeof window.showTraveler2 === 'function') {
      window.showTraveler2();
      ensureSignatureForTraveler2();
      updateAddButton();
      return;
    }

    var nextIndex = Math.max.apply(null, getActiveIndices()) + 1;
    if (nextIndex > max) return;

    var container = document.getElementById('extraTravelersContainer');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', buildTravelerSectionHtml(nextIndex));
    bindCountrySelects(container);
    if (typeof setupMunicipioSelector === 'function') setupMunicipioSelector(nextIndex);

    var sigContainer = document.getElementById('dynamicSignaturesContainer');
    if (sigContainer) {
      sigContainer.insertAdjacentHTML('beforeend', buildSignatureHtml(nextIndex));
      initSignatureForIndex(nextIndex);
    }
    updateAddButton();
  }

  function ensureSignatureForTraveler2() {
    var wrap = document.getElementById('signatureTraveler2Wrap');
    if (wrap) wrap.classList.remove('hidden');
    if (typeof window.initSignaturePad2 === 'function') window.initSignaturePad2();
  }

  function removeTraveler(index) {
    if (index === 2 && typeof window.hideTraveler2 === 'function') {
      window.hideTraveler2();
      var w2 = document.getElementById('signatureTraveler2Wrap');
      if (w2) w2.classList.add('hidden');
      updateAddButton();
      return;
    }
    var section = document.getElementById('travelerSection' + index);
    if (section) section.remove();
    var sig = document.getElementById('signatureBlock' + index);
    if (sig) sig.remove();
    delete signaturePads[index];
    updateAddButton();
  }

  function collectViajeros(formData) {
    var indices = getActiveIndices();
    var viajeros = [];
    var toISO = typeof toISODate === 'function' ? toISODate : function (v) { return String(v || ''); };
    var mapDoc = typeof mapDocType === 'function' ? mapDocType : function (v) { return v || 'PAS'; };
    var mapSx = typeof mapSexo === 'function' ? mapSexo : function (v) { return v || 'H'; };
    var convISO3 = typeof convertToISO3 === 'function' ? convertToISO3 : function (v) { return v || 'ESP'; };

    function getISO3FromInput(inputName) {
      var el = document.querySelector('[name="' + inputName + '"]');
      if (el && el.tagName === 'SELECT') return el.value || 'ESP';
      if (el && el.dataset && el.dataset.iso3) return el.dataset.iso3;
      return convISO3(formData.get(inputName));
    }

    indices.forEach(function (idx) {
      var nombreKey = fieldName('nombre', idx);
      var nombre = String(formData.get(nombreKey) || '').trim();
      if (!nombre) return;

      var ineEl = document.getElementById('codigoMunicipio' + idx);
      var ineVal = ineEl ? String(ineEl.value || '').trim() : '';
      if (ineVal) ineVal = ineVal.padStart(5, '0');

      var v = {
        nombre: nombre,
        primerApellido: String(formData.get(fieldName('apellido1', idx)) || '').trim(),
        segundoApellido: String(formData.get(fieldName('apellido2', idx)) || '').trim() || null,
        fechaNacimiento: toISO(formData.get(fieldName('fechaNacimiento', idx))),
        tipoDocumento: mapDoc(formData.get(fieldName('tipoDocumento', idx))),
        numeroDocumento: String((formData.get(fieldName('numeroDocumento', idx)) || '')).toUpperCase().replace(/\s+/g, ''),
        soporteDocumento: String(formData.get(fieldName('soporteDocumento', idx)) || '').trim().toUpperCase() || null,
        sexo: mapSx(formData.get(fieldName('sexo', idx))),
        nacionalidad: getISO3FromInput(fieldName('nacionalidad', idx)),
        telefono: String(formData.get(fieldName('telefono', idx)) || '').replace(/\s+/g, ''),
        correo: String(formData.get(fieldName('correo', idx)) || '').trim().toLowerCase(),
        direccion: String(formData.get(fieldName('direccion', idx)) || '').trim(),
        cp: (function () {
          var cp = String(formData.get(fieldName('codigoPostal', idx)) || '').trim();
          return cp ? cp.padStart(5, '0') : '';
        })(),
        ine: ineVal,
        nombreMunicipio: String(formData.get(fieldName('nombreMunicipio', idx)) || '').trim(),
        paisResidencia: getISO3FromInput(fieldName('pais', idx)),
      };

      if (v.paisResidencia === 'ESP') {
        if (!/^\d{5}$/.test(v.ine)) v.ine = '';
      } else {
        v.ine = '';
      }
      viajeros.push(v);
    });

    return viajeros;
  }

  function getSignatureDataAll() {
    var arr = [];
    if (window._signaturePad && !window._signaturePad.isEmpty()) {
      arr.push(window._signaturePad.toDataURL('image/png'));
    }
    getActiveIndices().forEach(function (idx) {
      if (idx === 1) return;
      if (idx === 2 && window._signaturePad2 && !window._signaturePad2.isEmpty()) {
        arr.push(window._signaturePad2.toDataURL('image/png'));
        return;
      }
      var pad = signaturePads[idx];
      if (pad && !pad.isEmpty()) arr.push(pad.toDataURL('image/png'));
    });
    return arr.length ? arr : null;
  }

  function init() {
    var hint = document.getElementById('travelersCapacityHint');
    if (!hint) {
      var travelersTitle = document.querySelector('[data-i18n="travelers.title"]');
      if (travelersTitle && travelersTitle.parentElement) {
        hint = document.createElement('p');
        hint.id = 'travelersCapacityHint';
        hint.className = 'text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4';
        travelersTitle.parentElement.parentElement.insertBefore(hint, travelersTitle.parentElement.nextSibling);
      }
    }

    var extraContainer = document.getElementById('extraTravelersContainer');
    if (!extraContainer) {
      var t2 = document.getElementById('traveler2Section');
      if (t2 && t2.parentNode) {
        extraContainer = document.createElement('div');
        extraContainer.id = 'extraTravelersContainer';
        t2.parentNode.insertBefore(extraContainer, t2.nextSibling);
      }
    }

    var sigExtra = document.getElementById('dynamicSignaturesContainer');
    if (!sigExtra) {
      var sig2wrap = document.getElementById('signatureTraveler2Wrap');
      if (sig2wrap && sig2wrap.parentNode) {
        sigExtra = document.createElement('div');
        sigExtra.id = 'dynamicSignaturesContainer';
        sigExtra.className = 'space-y-4';
        sig2wrap.parentNode.appendChild(sigExtra);
      }
    }

    var addBtn = document.getElementById('addTraveler2');
    if (addBtn) {
      addBtn.addEventListener('click', function (e) {
        e.preventDefault();
        addTraveler();
      });
    }

    document.addEventListener('click', function (e) {
      var rm = e.target.closest('.dyn-remove-traveler');
      if (rm) {
        e.preventDefault();
        removeTraveler(parseInt(rm.getAttribute('data-index'), 10));
      }
      var clr = e.target.closest('.dyn-clear-sig');
      if (clr) {
        var i = parseInt(clr.getAttribute('data-index'), 10);
        if (signaturePads[i]) signaturePads[i].clear();
        if (i === 2 && window._signaturePad2) window._signaturePad2.clear();
      }
    });

    var remove2 = document.getElementById('removeTraveler2');
    if (remove2) {
      remove2.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof window.hideTraveler2 === 'function') window.hideTraveler2();
        else removeTraveler(2);
      });
    }

    window.getSignatureData = getSignatureDataAll;

    updateAddButton();
  }

  window.DelfinTravelers = {
    getMaxGuests: getMaxGuests,
    getActiveIndices: getActiveIndices,
    collectViajeros: collectViajeros,
    updateAddButton: updateAddButton,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
