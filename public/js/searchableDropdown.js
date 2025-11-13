// public/js/searchableDropdown.js
import { COUNTRIES } from './countryData.js';
import * as DOM from './dom.js'; // To access the input element reference

export class SearchableDropdown {
    constructor(inputElement, optionsContainerElement, countryData) { 
        this.inputEl = inputElement;
        this.optionsContainerEl = optionsContainerElement;
        this.allOptions = countryData; // Use the passed data
        this.selectedValue = '';
        this.inputEl.autocomplete = 'off';
        
        this.setupListeners();
        this.renderOptions(this.allOptions);
        this.hideOptions(); // Start hidden
    }

    setupListeners() {
        this.inputEl.addEventListener('input', this.handleInput.bind(this));
        this.inputEl.addEventListener('focus', this.handleFocus.bind(this));
        this.inputEl.addEventListener('blur', this.handleBlur.bind(this));
    }

    handleInput(event) {
        const query = event.target.value.toLowerCase();
        
        // Always clear the selected value on input change
        this.selectedValue = ''; 

        if (query.length === 0) {
            this.renderOptions(this.allOptions);
            this.showOptions();
            return;
        }

        const filtered = this.allOptions.filter(country => 
            country.toLowerCase().includes(query)
        );

        this.renderOptions(filtered);
        this.showOptions();
    }
    
    handleFocus() {
        // Only show options if the input is empty or a selection hasn't been made
        if (this.selectedValue === '') {
             this.renderOptions(this.allOptions);
             this.showOptions();
        }
    }

    handleBlur() {
        // Delay hiding to allow click events on the options to register
        setTimeout(() => {
            this.hideOptions();
            
            // If the input doesn't match a valid country after blur, clear it 
            // unless a value was already selected via click.
            if (!this.allOptions.includes(this.inputEl.value) && this.inputEl.value.length > 0) {
                this.inputEl.value = this.selectedValue || ''; 
            }
        }, 1);
    }
    
    selectOption(value) {
        this.selectedValue = value;
        this.inputEl.value = value;
        this.hideOptions();
        // Manually trigger a change event so appLogic.js can react if needed
        this.inputEl.dispatchEvent(new Event('change')); 
    }

    renderOptions(options) {
        this.optionsContainerEl.innerHTML = '';
        if (options.length === 0) {
            this.optionsContainerEl.innerHTML = '<div class="dropdown-option disabled">No matches found</div>';
            return;
        }

        options.forEach(country => {
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.textContent = country;
            
            // Use 'mousedown' to fire before the 'blur' event
            div.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent blur from happening immediately
                this.selectOption(country);
            });
            
            this.optionsContainerEl.appendChild(div);
        });
    }

    showOptions() {
        this.optionsContainerEl.classList.remove('hidden');
    }

    hideOptions() {
        this.optionsContainerEl.classList.add('hidden');
    }
    
    reset() {
        this.inputEl.value = '';
        this.selectedValue = '';
        this.hideOptions();
    }
}