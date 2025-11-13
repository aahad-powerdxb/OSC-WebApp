// public/js/helper/dropdownSetup.js
import * as DOM from '../dom.js';
import { SearchableDropdown } from '../searchableDropdown.js';
import { fetchCountryNames } from '../fetchCountryData.js';

let nationalityDropdown = null;

export async function initializeDropdown() {
    if (DOM.nationalityInputEl && DOM.nationalityOptionsEl) {
        
        // NEW: Wait for the country data to load
        const countryData = await fetchCountryNames(); 
        
        nationalityDropdown = new SearchableDropdown(
            DOM.nationalityInputEl,
            DOM.nationalityOptionsEl,
            countryData // Pass the loaded data
        );
        console.log("Dropdown Initialized Successfully with data.");
    } else {
        console.error("DROPDOWN INIT FAILED: Input or Options Container not found.");
    }
}

export function resetNationalityDropdown() {
    if (nationalityDropdown) {
        nationalityDropdown.reset();
    }
}

export function getNationalityValue() {
    // We rely on the input value for form submission, which the class maintains
    return DOM.nationalityInputEl ? DOM.nationalityInputEl.value : '';
}