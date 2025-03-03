// Global variables to hold metadata
let books, chapters;

async function loadMetadata() {
    try {
        const response = await fetch('metadata.json');
        if (!response.ok) throw new Error('Failed to load metadata.json');
        const metadata = await response.json();
        books = metadata.books.map(b => b.english);
        chapters = metadata.chapters;
        initialize();
    } catch (error) {
        console.error('Error loading metadata:', error);
        document.getElementById('results').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

// Populate dropdowns
function populateBooks(selectId) {
    const select = document.getElementById(selectId);
    books.forEach(book => {
        const option = document.createElement('option');
        option.value = book;
        option.text = book;
        select.appendChild(option);
    });
}

function updateChapters(set) {
    const bookSelect = document.getElementById(`${set}-book`);
    const chapterSelect = document.getElementById(`${set}-chapter`);
    const book = bookSelect.value;
    chapterSelect.innerHTML = '';
    const numChapters = chapters[book];
    for (let i = 1; i <= numChapters; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.text = i;
        chapterSelect.appendChild(option);
    }
}

// Event listeners for dynamic updates
['from', 'to'].forEach(set => {
    document.getElementById(`${set}-book`).addEventListener('change', () => updateChapters(set));
});

function initialize() {
    populateBooks('from-book');
    populateBooks('to-book');
    updateChapters('from');
    updateChapters('to');
}

function getFilePath(book, chapter) {
    const folderName = book.replace(/ /g, '_');
    return `bhsa_json/${folderName}/${folderName}_chapter_${chapter}.json`;
}

// Frequency calculation
const frequencyMap = {};

function addToFrequency(lexicalForm) {
    frequencyMap[lexicalForm] = (frequencyMap[lexicalForm] || 0) + 1;
}

function generateFrequency() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    const loadingDiv = document.getElementById('loading');
    loadingDiv.style.display = 'block';

    const fromBook = document.getElementById('from-book').value;
    const fromChapter = parseInt(document.getElementById('from-chapter').value);
    const toBook = document.getElementById('to-book').value;
    const toChapter = parseInt(document.getElementById('to-chapter').value);

    const fromIndex = books.indexOf(fromBook);
    const toIndex = books.indexOf(toBook);

    const chaptersToFetch = [];
    for (let i = fromIndex; i <= toIndex; i++) {
        const book = books[i];
        const startChap = (i === fromIndex) ? fromChapter : 1;
        const endChap = (i === toIndex) ? toChapter : chapters[book];
        for (let chap = startChap; chap <= endChap; chap++) {
            chaptersToFetch.push({ book, chapter: chap });
        }
    }

    const promises = chaptersToFetch.map(({ book, chapter }) => {
        return fetch(getFilePath(book, chapter))
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch ${book} chapter ${chapter}`);
                return response.json();
            })
            .then(data => Object.values(data).flat())
            .catch(error => {
                console.error(error);
                return [];
            });
    });

    Promise.all(promises)
        .then(chaptersData => {
            const allWords = chaptersData.flat();
            const rootForms = {};

            // Helper function to remove dagesh
            const removeDagesh = (text) => text.replace(/\u05BC/g, '');

            // Parts of speech to skip
            const skipPOS = new Set(["prep", "conj", "art"]);

            // Update loading message
            loadingDiv.innerHTML = 'Processing words...';

            // First pass: organize by root (fourth word_form) and collect forms
            allWords.forEach(word => {
                // Skip prepositions, conjunctions, and articles
                if (word.pos_tag && skipPOS.has(word.pos_tag.pdp)) {
                    return;
                }

                const root = word.word_forms[3];
                // Remove dagesh from the form
                const formWithDagesh = word.word_forms[1];
                const form = removeDagesh(formWithDagesh);
                const gloss = word.gloss;

                if (!rootForms[root]) {
                    rootForms[root] = {
                        total: 0,
                        forms: {},
                        originalForms: {} // Keep track of original forms for reference
                    };
                }
                rootForms[root].total++;

                if (!rootForms[root].forms[form]) {
                    rootForms[root].forms[form] = {
                        count: 0,
                        glosses: new Set(),
                        originalForms: new Set() // Track original forms with dagesh
                    };
                }
                rootForms[root].forms[form].count++;
                // Clean up the gloss by removing XML-like tags
                const cleanGloss = gloss.replace(/<[^>]*>/g, '').trim();
                if (cleanGloss) {
                    rootForms[root].forms[form].glosses.add(cleanGloss);
                }
                // Store the original form with dagesh for reference
                rootForms[root].forms[form].originalForms.add(formWithDagesh);
            });

            // Update loading message
            loadingDiv.innerHTML = 'Generating vocabulary list...';

            // Generate HTML output
            let html = '<div class="vocabulary-list">';
            
            // Sort roots by total frequency
            const sortedRoots = Object.entries(rootForms)
                .sort((a, b) => b[1].total - a[1].total)
                .filter(([root]) => root); // Filter out empty roots

            // Add summary header
            html += `<div class="summary">
                <p>Found ${sortedRoots.length} unique roots in selected range</p>
            </div>`;

            sortedRoots.forEach(([root, data]) => {
                html += `<div class="root-entry">
                    <div class="root-header">
                        <b>${root}</b> <span class="total-count">(${data.total} occurrences)</span>
                    </div>`;
                
                // Sort forms by frequency
                const sortedForms = Object.entries(data.forms)
                    .sort((a, b) => b[1].count - a[1].count)
                    .filter(([form]) => form); // Filter out empty forms

                if (sortedForms.length > 0) {
                    html += '<ul class="forms-list">';
                    sortedForms.forEach(([form, formData]) => {
                        const glosses = Array.from(formData.glosses)
                            .filter(g => g) // Remove empty glosses
                            .join(', ');
                        
                        // Get all original forms (with and without dagesh)
                        const originalForms = Array.from(formData.originalForms).sort();
                        const formDisplay = originalForms.length > 1 ? 
                            originalForms.join(' / ') : 
                            form;

                        html += `<li class="form-entry">
                            <span class="form">${formDisplay}</span>
                            <span class="count">(${formData.count})</span>
                            <span class="glosses">${glosses ? ': ' + glosses : ''}</span>
                        </li>`;
                    });
                    html += '</ul>';
                }
                html += '</div>';
            });

            html += '</div>';
            resultsDiv.innerHTML = html;
            loadingDiv.style.display = 'none';
        })
        .catch(error => {
            resultsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            loadingDiv.style.display = 'none';
        });
}

// Start the application
loadMetadata();