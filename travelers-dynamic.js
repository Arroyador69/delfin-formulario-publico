/**
 * Viajeros dinámicos según max_guests (query param desde admin).
 * Límite MIR: 50 personas por comunicación.
 */
(function () {
  'use strict';

  var MIR_MAX = 50;
  var DEFAULT_MAX = 2;
  var resolvedMaxGuests = null;
  var maxGuestsFetchStarted = false;

  function clampMax(raw) {
    var n = parseInt(String(raw || ''), 10);
    if (!isFinite(n)) return DEFAULT_MAX;
    return Math.max(1, Math.min(MIR_MAX, n));
  }

  function getUrlParams() {
    try {
      return new URLSearchParams(window.location.search);
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function getMaxGuests() {
    if (resolvedMaxGuests !== null) return resolvedMaxGuests;
    return clampMax(getUrlParams().get('max_guests'));
  }

  function getAdminOrigin() {
    var apiEndpoint = getUrlParams().get('api_endpoint') || '';
    if (!apiEndpoint) return '';
    try {
      return new URL(apiEndpoint).origin;
    } catch (e) {
      return '';
    }
  }

  function fetchMaxGuestsFromAdmin(done) {
    if (maxGuestsFetchStarted) return;
    maxGuestsFetchStarted = true;

    var params = getUrlParams();
    var tenantId = params.get('tenant_id');
    if (!tenantId) {
      resolvedMaxGuests = getMaxGuests();
      if (typeof done === 'function') done(resolvedMaxGuests);
      return;
    }

    var origin = getAdminOrigin();
    if (!origin) {
      resolvedMaxGuests = getMaxGuests();
      if (typeof done === 'function') done(resolvedMaxGuests);
      return;
    }

    var qs = new URLSearchParams({ tenant_id: tenantId });
    var roomId = params.get('room_id');
    var propertyId = params.get('property_id');
    if (roomId) qs.set('room_id', roomId);
    if (propertyId) qs.set('property_id', propertyId);

    fetch(origin + '/api/public/form/max-guests?' + qs.toString())
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        var fromUrl = clampMax(getUrlParams().get('max_guests'));
        if (data && data.max_guests != null) {
          resolvedMaxGuests = clampMax(data.max_guests);
        } else {
          resolvedMaxGuests = fromUrl;
        }
        if (typeof done === 'function') done(resolvedMaxGuests);
        updateAddButton();
      })
      .catch(function () {
        resolvedMaxGuests = getMaxGuests();
        if (typeof done === 'function') done(resolvedMaxGuests);
      });
  }

  function t(key, vars) {
    var s = key;
    if (typeof window.getTranslation === 'function') {
      s = window.getTranslation(key);
    } else if (window.translations) {
      var lang = document.documentElement.lang || 'es';
      var dict = window.translations[lang] || window.translations.es || {};
      s = dict[key] || key;
    }
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
  }

  function bindTravelerIneFields(index) {
    var paisEl = document.querySelector('[name="' + fieldName('pais', index) + '"]');
    var ineEl = document.getElementById('codigoMunicipio' + index);
    var municipioEl = document.getElementById('nombreMunicipio' + index);
    var ineRequired = document.getElementById('ineRequired' + index);
    var municipioRequired = document.getElementById('municipioRequired' + index);
    if (!paisEl || !ineEl || !municipioEl || typeof updateFields !== 'function') return;
    var apply = function () {
      updateFields(paisEl, ineEl, ineRequired, municipioEl, municipioRequired);
    };
    apply();
    paisEl.addEventListener('change', apply);
  }

  function bindTravelerDocType(index) {
    var tipoEl = document.querySelector('[name="' + fieldName('tipoDocumento', index) + '"]');
    if (!tipoEl) return;
    tipoEl.addEventListener('change', function () {
      if (typeof applySoporteDocumentoUi === 'function') applySoporteDocumentoUi(String(index));
    });
    if (typeof applySoporteDocumentoUi === 'function') applySoporteDocumentoUi(String(index));
  }

  function bindTravelerFieldLogic(index) {
    bindTravelerIneFields(index);
    bindTravelerDocType(index);
  }

  function getISO3FromInput(inputName, formData) {
    var el = document.querySelector('[name="' + inputName + '"]');
    if (el && el.tagName === 'SELECT') return el.value || '';
    if (el && el.dataset && el.dataset.iso3) return el.dataset.iso3;
    var raw = formData ? formData.get(inputName) : '';
    if (typeof convertToISO3 === 'function') return convertToISO3(raw) || '';
    return String(raw || '').trim();
  }

  function validateBeforeSubmit(formData) {
    var indices = getActiveIndices();
    for (var i = 0; i < indices.length; i++) {
      var idx = indices[i];
      var nombre = String(formData.get(fieldName('nombre', idx)) || '').trim();
      if (!nombre) continue;

      var nacionalidad = getISO3FromInput(fieldName('nacionalidad', idx), formData);
      if (!nacionalidad) {
        return {
          message: 'Seleccione la nacionalidad del viajero ' + idx,
          field: fieldName('nacionalidad', idx),
        };
      }

      var pais = getISO3FromInput(fieldName('pais', idx), formData);
      if (!pais) {
        return {
          message: 'Seleccione el país de residencia del viajero ' + idx,
          field: fieldName('pais', idx),
        };
      }

      if (idx >= 3 && typeof validateDoc === 'function') {
        var docErr = validateDoc(
          formData.get(fieldName('tipoDocumento', idx)),
          formData.get(fieldName('numeroDocumento', idx))
        );
        if (docErr) return { message: docErr, field: fieldName('numeroDocumento', idx) };
      }

      if (typeof validateSoporteDocumento === 'function') {
        var soporteErr = validateSoporteDocumento(
          formData.get(fieldName('tipoDocumento', idx)),
          formData.get(fieldName('soporteDocumento', idx))
        );
        if (soporteErr) return { message: soporteErr, field: fieldName('soporteDocumento', idx) };
      }

      if (nacionalidad === 'ESP') {
        var ap2 = String(formData.get(fieldName('apellido2', idx)) || '').trim();
        if (!ap2) {
          return {
            message: 'El segundo apellido es obligatorio para españoles (viajero ' + idx + ')',
            field: fieldName('apellido2', idx),
          };
        }
      }

      if (pais === 'ESP') {
        var ineEl = document.getElementById('codigoMunicipio' + idx);
        var ineVal = ineEl ? String(ineEl.value || '').trim() : '';
        if (!/^\d{5}$/.test(ineVal)) {
          return {
            message: 'Para españoles es obligatorio el código INE del municipio (viajero ' + idx + ')',
            field: 'codigoMunicipio' + idx,
          };
        }
      } else {
        var nm = String(formData.get(fieldName('nombreMunicipio', idx)) || '').trim();
        if (!nm) {
          return {
            message: 'Indique el municipio/ciudad de residencia (viajero ' + idx + ')',
            field: fieldName('nombreMunicipio', idx),
          };
        }
      }
    }
    return null;
  }

  function isSignatureEmptyAll() {
    var indices = getActiveIndices();
    for (var i = 0; i < indices.length; i++) {
      var idx = indices[i];
      if (idx === 1) {
        if (!window._signaturePad || window._signaturePad.isEmpty()) return true;
      } else if (idx === 2) {
        if (!window._signaturePad2 || window._signaturePad2.isEmpty()) return true;
      } else {
        var pad = signaturePads[idx];
        if (!pad || pad.isEmpty()) return true;
      }
    }
    return false;
  }

  function showSignatureErrorAll() {
    var indices = getActiveIndices();
    for (var i = 0; i < indices.length; i++) {
      var idx = indices[i];
      var empty = false;
      if (idx === 1) empty = !window._signaturePad || window._signaturePad.isEmpty();
      else if (idx === 2) empty = !window._signaturePad2 || window._signaturePad2.isEmpty();
      else empty = !signaturePads[idx] || signaturePads[idx].isEmpty();
      if (empty) {
        var wrapId = idx === 1 ? 'signaturePadWrapper' : 'signaturePadWrapper' + idx;
        var wrap = document.getElementById(wrapId);
        if (wrap) {
          wrap.classList.add('field-error');
          wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
    }
  }

  function bindCountrySelects(root) {
    if (typeof populateCountrySelects === 'function') {
      setTimeout(function () {
        populateCountrySelects(document.documentElement.lang || 'es', root);
      }, 50);
    }
  }

  function soporteDocumentoBlock(index) {
    var name = fieldName('soporteDocumento', index);
    return (
      '<div id="soporteDocumentoWrap' + index + '" class="hidden md:col-span-2">' +
      '<label id="soporteDocumentoLabel' + index + '" class="block text-sm font-medium text-gray-700 mb-2">' +
      t('travelers.documentSupportDni') + '</label>' +
      '<input type="text" name="' + name + '" class="form-input" maxlength="20" placeholder="Ej. CAA000000" autocomplete="off" />' +
      '<p id="soporteDocumentoHint' + index + '" class="text-xs text-gray-500 mt-1">' +
      t('travelers.documentSupportHintDni') + '</p></div>'
    );
  }

  function ineContainerBlock(index) {
    var codigoName = fieldName('codigoMunicipio', index);
    return (
      '<div id="ineContainer' + index + '" class="md:col-span-2">' +
      '<label class="block text-sm font-medium text-gray-700 mb-2">' + t('travelers.municipalityCode') +
      ' <span id="ineRequired' + index + '" class="text-red-500">*</span></label>' +
      '<div class="relative">' +
      '<input type="text" name="' + codigoName + '" id="codigoMunicipio' + index +
      '" class="form-input" maxlength="5" placeholder="29042" readonly />' +
      '<input type="text" id="municipioSearch' + index +
      '" class="form-input mt-2" placeholder="Buscar municipio (ej: Fuengirola, Málaga...)" autocomplete="off" />' +
      '<div id="municipioResults' + index +
      '" class="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg hidden max-h-48 overflow-y-auto"></div>' +
      '</div>' +
      '<p class="text-xs text-gray-500 mt-1"><span data-i18n="travelers.municipalityHelp" data-i18n-html>' +
      t('travelers.municipalityHelp') + '</span></p></div>'
    );
  }

  function municipioNameBlock(index) {
    var name = fieldName('nombreMunicipio', index);
    return (
      '<div class="md:col-span-2">' +
      '<label class="block text-sm font-medium text-gray-700 mb-2">' + t('travelers.municipalityName') +
      ' <span id="municipioRequired' + index + '" class="text-red-500 hidden">*</span></label>' +
      '<input type="text" name="' + name + '" id="nombreMunicipio' + index +
      '" class="form-input" placeholder="Helsinki, Paris, London..." />' +
      '<p class="text-xs text-gray-500 mt-1"><span data-i18n="travelers.municipalityNameHelp" data-i18n-html>' +
      t('travelers.municipalityNameHelp') + '</span></p></div>'
    );
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
      soporteDocumentoBlock(index) +
      nationalitySelect(index) +
      selectField('sexo', index, t('travelers.gender')) +
      inputField('telefono', index, t('travelers.phone'), true) +
      inputField('correo', index, t('travelers.email'), true) +
      inputField('direccion', index, t('travelers.address'), true) +
      inputField('codigoPostal', index, t('travelers.postalCode'), true) +
      countrySelect(index) +
      ineContainerBlock(index) +
      municipioNameBlock(index) +
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
    return '<div><label class="block text-sm font-medium text-gray-700 mb-2">' + t('travelers.nationality') +
      ' <span class="text-red-500">*</span></label>' +
      '<select name="' + name + '" class="form-input nationality-select" required><option value="">—</option></select>' +
      '<p class="text-xs text-gray-500 mt-1">Seleccione la nacionalidad del viajero. Se usará el código ISO3 estándar para el registro MIR.</p></div>';
  }

  function countrySelect(index) {
    var name = fieldName('pais', index);
    return '<div><label class="block text-sm font-medium text-gray-700 mb-2">' + t('travelers.country') +
      ' <span class="text-red-500">*</span></label>' +
      '<select name="' + name + '" class="form-input country-select" required><option value="">—</option></select>' +
      '<p class="text-xs text-gray-500 mt-1">Seleccione el país de residencia del viajero. Se usará el código ISO3 estándar para el registro MIR.</p></div>';
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
    var newSection = document.getElementById('travelerSection' + nextIndex);
    bindCountrySelects(newSection || container);
    if (typeof setupMunicipioSelector === 'function') setupMunicipioSelector(nextIndex);
    bindTravelerFieldLogic(nextIndex);

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
        nacionalidad: getISO3FromInput(fieldName('nacionalidad', idx), formData),
        telefono: String(formData.get(fieldName('telefono', idx)) || '').replace(/\s+/g, ''),
        correo: String(formData.get(fieldName('correo', idx)) || '').trim().toLowerCase(),
        direccion: String(formData.get(fieldName('direccion', idx)) || '').trim(),
        cp: (function () {
          var cp = String(formData.get(fieldName('codigoPostal', idx)) || '').trim();
          return cp ? cp.padStart(5, '0') : '';
        })(),
        ine: ineVal,
        nombreMunicipio: String(formData.get(fieldName('nombreMunicipio', idx)) || '').trim(),
        paisResidencia: getISO3FromInput(fieldName('pais', idx), formData),
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

  function removeCapacityHint() {
    var hint = document.getElementById('travelersCapacityHint');
    if (hint) hint.remove();
  }

  function init() {
    removeCapacityHint();
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
    window.isSignatureEmpty = isSignatureEmptyAll;

    updateAddButton();
    fetchMaxGuestsFromAdmin(function () {
      updateAddButton();
    });
  }

  window.DelfinTravelers = {
    getMaxGuests: getMaxGuests,
    getActiveIndices: getActiveIndices,
    collectViajeros: collectViajeros,
    updateAddButton: updateAddButton,
    validateBeforeSubmit: validateBeforeSubmit,
    isSignatureEmpty: isSignatureEmptyAll,
    showSignatureError: showSignatureErrorAll,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
