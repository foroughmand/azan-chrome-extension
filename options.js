const container = document.getElementById('container');


function buildForm(selectedCity, method, cities, countries) {
    console.log('Building autocomplete form');
    // container.innerHTML = '';

    // const label = document.createElement('label');
    // label.textContent = 'Search City';
    // const input = document.createElement('input');
    // input.type = 'text';
    // input.placeholder = 'Type to search...';

    // const list = document.createElement('ul');
    // list.className = 'suggestions';
    const input = document.getElementById('city-search');
    console.log('Input element:', input);

    const list = document.getElementById('suggestions');

    console.log('City = ', selectedCity);

    let selected = selectedCity;

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        list.innerHTML = '';

        if (q.length < 2) return; // start showing after 2 chars

        const filtered = cities
            .filter(c =>
                c.city.toLowerCase().includes(q) ||
                (c.alternatenames && c.alternatenames.join(',').toLowerCase().includes(q))
            )
            .slice(0, 50); // limit to 50 results for performance

        filtered.forEach(c => {
            const li = document.createElement('li');
            li.textContent = `${c.city} (${countries[c.country_code] || c.country_code})`;
            li.addEventListener('click', () => {
                input.value = `${c.city} (${countries[c.country_code] || c.country_code})`;
                selected = c;
                list.innerHTML = '';
            });
            list.appendChild(li);
        });
    });

    // const btn = document.createElement('button');
    const btn = document.getElementById('save-btn');

    // btn.textContent = 'Save';
    btn.addEventListener('click', () => {
        const method = document.getElementById('method').value;
        if (!selected) return alert('Please select a city from the list.');
        if (!method || method == '') return alert('Please select a method from the list.');
        chrome.storage.sync.set({ selectedCity: selected, method: method }, () => {
            btn.textContent = 'Saved';
            setTimeout(() => (btn.textContent = 'Save'), 1000);
            // chrome.runtime.sendMessage({ action: 'refreshConfig' });
            
        });
        
        // const method = document.getElementById('method').value;
        // chrome.storage.sync.set({ method });
    });

    // container.appendChild(label);
    // container.appendChild(input);
    // container.appendChild(list);
    // container.appendChild(btn);

    // if a city is already selected
    if (selectedCity != null) {
        input.value = `${selectedCity.city} (${countries[selectedCity.country_code] || selectedCity.country_code})`;
        // console.log('Pre-filled input with selected city:', input.value);
    }

    if (method != null) {
        document.getElementById('method').value = method;
    } else {
        document.getElementById('method').value = '';
    }
    // // Save on change
    // document.getElementById('method').addEventListener('change', (e) => {
    //     const method = e.target.value;
    //     chrome.storage.sync.set({ method });
    // });
}

(async () => {
    const cities = await loadCities();
    const countries = await loadCountriesDict();

    // container.insertAdjacentHTML('beforeend', `
    // `);
    // Load current settings and fill dropdown
    // chrome.storage.sync.get({ method: 'Tehran' }, (res) => {
    // });

    chrome.storage.sync.get(['selectedCity', 'method'], (res) => {
        buildForm(res.selectedCity  || null, res.method || null, cities, countries);
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
        chrome.storage.sync.remove(['selectedCity', 'method'], () => {
            // document.getElementById('city-search').value = '';
            // document.getElementById('method').value = 'Tehran';
            // const list = document.getElementById('suggestions');
            // list.innerHTML = '';
            window.close();
        });
    });

    // save when user changes the selection
    // document.getElementById('method').addEventListener('change', (e) => {
    //     chrome.storage.sync.set({ method: e.target.value });
    // });
})();
