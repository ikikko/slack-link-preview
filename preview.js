window.addEventListener('load', () => {

    chrome.storage.local.get(null, async (tokens) => {

        for (const workspace in tokens) {
            const links = document.querySelectorAll(`a[href^="https://${workspace}.slack.com/archives/"]`);

            for (const link of links) {
                const [channel, timestamp] = getChannelAndTimestamp(link.getAttribute("href"), workspace);
                if (!channel) break;

                const message = await getMessage(channel, timestamp, tokens[workspace]);
                const profile = await getProfile(message.user, tokens[workspace]);

                message.text = await replaceMessageText(message.text, tokens[workspace]);

                insertPreviewElement(link, message, profile);
            }
        }

    });

});

function getChannelAndTimestamp(url, workspace) {
    const matches = url.match(`https://${workspace}.slack.com/archives/(\\w+)/p(\\d+)`);
    if (!matches) return [];

    const channel = matches[1];
    const timestamp = matches[2].substring(0, 10) + "." + matches[2].substring(10);

    return [channel, timestamp];
}

async function getMessage(channel, timestamp, token) {
    const params = new URLSearchParams({
        channel: channel,
        timestamp: timestamp,
    }).toString();
    const json = await postSlackApi("reactions.get", params, token);
    const message = json.message;

    return message;
}

async function getProfile(user, token) {
    const params = new URLSearchParams({ user: user }).toString();
    const json = await postSlackApi("users.profile.get", params, token);
    const profile = json.profile;

    return profile;
}

async function postSlackApi(api, params, token) {
    const url = `https://slack.com/api/${api}?${params}`;
    const data = new FormData();
    data.append("token", token);

    const response = await fetch(url, {
        method: "POST",
        body: data,
    });
    const json = await response.json();

    console.log(json); // for debug

    return json;
}

async function replaceMessageText(text, token) {
    let result = text;

    result = await replaceUserIdToName(result, token);
    result = escapeHtmlSpecialChars(result);
    result = convertToHtml(result);

    return result;

    // --- inner function ---

    async function replaceUserIdToName(str, token) {
        return replaceAsync(str, /<@(\w+)>/g, async (_, p1) => {
            const profile = await getProfile(p1, token);

            return profile.display_name ? `@${profile.display_name}` : `@${profile.real_name}`;
        });

        /**
         * see https://stackoverflow.com/a/48032528
         */
        async function replaceAsync(str, regex, asyncFn) {
            const promises = [];
            str.replace(regex, (match, ...args) => {
                const promise = asyncFn(match, ...args);
                promises.push(promise);
            });
            const data = await Promise.all(promises);
            return str.replace(regex, () => data.shift());
        }
    }

    function escapeHtmlSpecialChars(str) {
        return str.replace(
            /[&'`"<>]/g, (match) => {
                return {
                    // メッセージ中のURLやhereは`<https://...>`や`<!here>`の形式で渡され、それ以外はエスケープされて渡されてくる。
                    // そのため、ここでは周りの`<>`をエスケープし、それ以外は二重にエスケープしないように、&をエスケープ対象から外す。
                    //
                    // '&': '&amp;',
                    '&': '&',
                    "'": '&#x27;',
                    '`': '&#x60;',
                    '"': '&quot;',
                    '<': '&lt;',
                    '>': '&gt;',
                }[match]
            }
        );
    }

    function convertToHtml(str) {
        return str.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
    }
}

function insertPreviewElement(target, message, profile) {
    const parent = target.parentNode;
    const element = createPreviewElement(message, profile);

    parent.insertBefore(element, target.nextSibling);

    // --- inner function ---

    function createPreviewElement(message, profile) {
        const template = `
        <div class="slack-preview" style="border: 1px solid rgba(55, 53, 47, 0.16); padding: 6px; margin-top: 6px; margin-bottom: 6px; display: flex;">
            <div style="position: relative; margin: 3px 12px 3px 4px; width: 32px; height: 32px;">
                <img src="${profile.image_72}"
                    style="width: 32px; border-radius: 32px; max-width: initial;">
                <img src="https://cdn.bfldr.com/5H442O3W/at/pl546j-7le8zk-afym5u/Slack_Mark_Web.png?auto=webp&format=png"
                    style="position: absolute; bottom: -16px; right: -8px; width: 24px;">
            </div>
            <div>${message.text}</div>
        </div>
    `
        const doc = new DOMParser().parseFromString(template, "text/html");
        const element = doc.getElementsByClassName("slack-preview")[0];

        return element;
    }
}
