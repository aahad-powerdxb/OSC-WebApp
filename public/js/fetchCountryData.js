// public/js/fetchCountryData.js

// Define the path relative to the public root
const DATA_PATH = './json/countryData.json';

/**
 * Fetches the country list from the JSON file and returns an array of names.
 * @returns {Promise<string[]>} A promise that resolves to an array of country names.
 */
export async function fetchCountryNames() {
    try {
        const response = await fetch(DATA_PATH);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Data is an array of objects: [{ name: "...", code: "..." }, ...]
        const data = await response.json(); 
        
        // Map the array to extract only the 'name' property
        const countryNames = data.map(item => item.name);
        
        // Add "Other" manually for your form consistency, if not present in the JSON
        if (!countryNames.includes("Other")) {
            countryNames.push("Other");
        }
        
        return countryNames;

    } catch (error) {
        console.error("Failed to load country data:", error);
        // Return an empty list to prevent application crash
        return ["Error Loading Data", "Other"]; 
    }
}