// Add toggles to the Simple Tab sidebar
function initSimpleToggles() {
    let sidebar = document.getElementById('simple_input_sidebar');
    if (!sidebar) return;

    // Logic to inject "Generate Forever" and "Generate Previews" 
    // into the Simple Tab sidebar as toggle switches.
}

window.addEventListener('keydown', (e) => {
    // Check if the Simple Tab is active
    if (document.getElementById('simpletabbutton').classList.contains('active')) {
        let activeLora = document.querySelector('.preset-in-list:hover .lora-weight-input'); // Example: targeting on hover
        if (activeLora) {
            if (e.key === '+' || e.key === '=') {
                activeLora.value = (parseFloat(activeLora.value) + 0.1).toFixed(1);
                activeLora.dispatchEvent(new Event('change'));
            } else if (e.key === '-' || e.key === '_') {
                activeLora.value = (parseFloat(activeLora.value) - 0.1).toFixed(1);
                activeLora.dispatchEvent(new Event('change'));
            }
        }
    }
});