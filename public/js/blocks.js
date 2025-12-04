const BLOCKS = [
    { value: 'Block A', label: 'Block A - Champion Champion Alpha' },
    { value: 'Block B', label: 'Block B - The Great Republic of Siberia' },
    { value: 'Block C', label: 'Block C - Champion Chalice' },
    { value: 'Block D', label: 'Block D - The Mighty Veterans' },
    { value: 'Block E', label: 'Block E - Manz of Mafia' },
    { value: 'Block F', label: 'Block F - The Falcon Fighters' },
    { value: 'Block G', label: 'Block G - The Angels of Genesis' }
];

function populateBlockSelect(selectElement) {
    if (!selectElement) return;

    const firstOption = selectElement.querySelector('option[value=""]');
    selectElement.innerHTML = '';

    if (firstOption) {
        selectElement.appendChild(firstOption);
    } else {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select a block...';
        selectElement.appendChild(placeholder);
    }

    BLOCKS.forEach(block => {
        const option = document.createElement('option');
        option.value = block.value;
        option.textContent = block.label;
        selectElement.appendChild(option);
    });
}
