// Utilidades para manejar selects de países/nacionalidades
// Este archivo se incluirá en el formulario público para manejar los selects

class CountrySelectManager {
  constructor() {
    this.currentLanguage = 'es';
    this.countries = [];
    this.init();
  }

  init() {
    // Obtener idioma actual del formulario
    this.currentLanguage = this.detectLanguage();
    
    // Obtener países ordenados
    this.countries = getCountriesSorted(this.currentLanguage);
    
    // Inicializar selects existentes
    this.initializeSelects();
  }

  detectLanguage() {
    // Detectar idioma del formulario
    const langSelect = document.getElementById('language-select');
    if (langSelect) {
      return langSelect.value || 'es';
    }
    
    // Detectar por atributo del body
    const bodyLang = document.body.getAttribute('data-lang');
    if (bodyLang) {
      return bodyLang;
    }
    
    // Detectar por navegador
    const browserLang = navigator.language.split('-')[0];
    if (['es', 'en', 'fr', 'ru'].includes(browserLang)) {
      return browserLang;
    }
    
    return 'es'; // Default
  }

  initializeSelects() {
    // Convertir inputs de texto a selects
    this.convertInputToSelect('nacionalidad', 'España');
    this.convertInputToSelect('pais', '');
    this.convertInputToSelect('nacionalidad2', 'España');
    this.convertInputToSelect('pais2', '');
    
    // Agregar event listeners para cambios de idioma
    this.setupLanguageChangeListener();
  }

  convertInputToSelect(inputName, defaultValue) {
    const input = document.querySelector(`input[name="${inputName}"]`);
    if (!input) return;

    // Crear el select
    const select = document.createElement('select');
    select.name = inputName;
    select.className = input.className;
    select.required = input.required;
    
    // Agregar opción vacía si no hay valor por defecto
    if (!defaultValue) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = this.getSelectPlaceholder(inputName);
      select.appendChild(emptyOption);
    }

    // Agregar países
    this.countries.forEach(country => {
      const option = document.createElement('option');
      option.value = country.iso3;
      option.textContent = country.name;
      
      // Marcar como seleccionado si coincide con el valor por defecto
      if (this.isCountryMatch(country, defaultValue)) {
        option.selected = true;
      }
      
      select.appendChild(option);
    });

    // Reemplazar el input con el select
    input.parentNode.replaceChild(select, input);
    
    // Agregar event listener para cambios
    select.addEventListener('change', () => {
      this.handleCountryChange(select);
    });
  }

  getSelectPlaceholder(inputName) {
    const placeholders = {
      'nacionalidad': 'Seleccione nacionalidad',
      'nacionalidad2': 'Seleccione nacionalidad',
      'pais': 'Seleccione país',
      'pais2': 'Seleccione país'
    };
    
    return placeholders[inputName] || 'Seleccione...';
  }

  isCountryMatch(country, searchTerm) {
    if (!searchTerm) return false;
    
    const searchLower = searchTerm.toLowerCase();
    return Object.values(country.name).some(name => 
      name.toLowerCase().includes(searchLower)
    );
  }

  handleCountryChange(select) {
    const countryCode = select.value;
    const countryName = getCountryName(countryCode, this.currentLanguage);
    
    console.log(`País seleccionado: ${countryName} (${countryCode})`);
    
    // Actualizar campos relacionados según el país
    this.updateRelatedFields(select, countryCode, countryName);
  }

  updateRelatedFields(select, countryCode, countryName) {
    const inputName = select.name;
    
    // Si es España, mostrar campos INE
    if (countryCode === 'ESP') {
      this.showINEFields(inputName);
    } else {
      this.hideINEFields(inputName);
    }
    
    // Actualizar lógica específica según el tipo de campo
    if (inputName.includes('nacionalidad')) {
      this.updateNationalityFields(select, countryCode);
    } else if (inputName.includes('pais')) {
      this.updateCountryFields(select, countryCode);
    }
  }

  showINEFields(inputName) {
    // Mostrar campos INE para España
    const isSecondTraveler = inputName.includes('2');
    const ineInput = document.getElementById(isSecondTraveler ? 'codigoMunicipio2' : 'codigoMunicipio1');
    const ineRequired = document.getElementById(isSecondTraveler ? 'ineRequired2' : 'ineRequired1');
    
    if (ineInput) {
      ineInput.style.display = 'block';
      if (ineRequired) {
        ineRequired.style.display = 'block';
        ineInput.required = true;
      }
    }
  }

  hideINEFields(inputName) {
    // Ocultar campos INE para países extranjeros
    const isSecondTraveler = inputName.includes('2');
    const ineInput = document.getElementById(isSecondTraveler ? 'codigoMunicipio2' : 'codigoMunicipio1');
    const ineRequired = document.getElementById(isSecondTraveler ? 'ineRequired2' : 'ineRequired1');
    
    if (ineInput) {
      ineInput.style.display = 'none';
      ineInput.required = false;
      if (ineRequired) {
        ineRequired.style.display = 'none';
      }
    }
  }

  updateNationalityFields(select, countryCode) {
    // Lógica específica para cambios de nacionalidad
    console.log(`Nacionalidad actualizada a: ${countryCode}`);
  }

  updateCountryFields(select, countryCode) {
    // Lógica específica para cambios de país
    console.log(`País actualizado a: ${countryCode}`);
  }

  setupLanguageChangeListener() {
    const langSelect = document.getElementById('language-select');
    if (langSelect) {
      langSelect.addEventListener('change', () => {
        this.currentLanguage = langSelect.value;
        this.countries = getCountriesSorted(this.currentLanguage);
        this.refreshSelects();
      });
    }
  }

  refreshSelects() {
    // Refrescar todos los selects con el nuevo idioma
    const selects = document.querySelectorAll('select[name*="nacionalidad"], select[name*="pais"]');
    
    selects.forEach(select => {
      const currentValue = select.value;
      const inputName = select.name;
      
      // Limpiar opciones
      select.innerHTML = '';
      
      // Agregar opción vacía si corresponde
      if (!this.hasDefaultValue(inputName)) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = this.getSelectPlaceholder(inputName);
        select.appendChild(emptyOption);
      }
      
      // Agregar países actualizados
      this.countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.iso3;
        option.textContent = country.name;
        
        if (country.iso3 === currentValue) {
          option.selected = true;
        }
        
        select.appendChild(option);
      });
    });
  }

  hasDefaultValue(inputName) {
    return inputName.includes('nacionalidad');
  }

  // Método para obtener el valor ISO3 de un select
  getISO3Value(selectName) {
    const select = document.querySelector(`select[name="${selectName}"]`);
    return select ? select.value : '';
  }

  // Método para establecer el valor de un select por ISO3
  setISO3Value(selectName, iso3Code) {
    const select = document.querySelector(`select[name="${selectName}"]`);
    if (select) {
      select.value = iso3Code;
      this.handleCountryChange(select);
    }
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.countrySelectManager = new CountrySelectManager();
});

// Función global para compatibilidad con código existente
function getISO3FromSelect(selectName) {
  if (window.countrySelectManager) {
    return window.countrySelectManager.getISO3Value(selectName);
  }
  return '';
}

// Función global para establecer valor en select
function setISO3InSelect(selectName, iso3Code) {
  if (window.countrySelectManager) {
    window.countrySelectManager.setISO3Value(selectName, iso3Code);
  }
}
