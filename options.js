chrome.storage.local.get(null, (tokens) => {
    let i = 1;
    for (let workspace in tokens) {
        document.getElementById(`workspace${i}`).value = workspace;
        document.getElementById(`token${i}`).value = tokens[workspace];
        i++;
    }
});

document.getElementById("button").addEventListener("click", () => {
    let tokens = {};

    for (let i = 1; i < 6; i++) {
        const workspace = document.getElementById(`workspace${i}`);
        const token = document.getElementById(`token${i}`);

        if (workspace.value) {
            tokens[workspace.value] = token.value;
        }
    }

    chrome.storage.local.clear(() => {
        chrome.storage.local.set(tokens);
    });
});
