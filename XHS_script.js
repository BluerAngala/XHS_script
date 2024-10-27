// ==UserScript==
// @name         XHS-Downloader
// @namespace    https://github.com/JoeanAmier/XHS-Downloader
// @version      1.7.3
// @description  基于XHS-Downloader二次开发的小红书工具。可以提取小红书作品/用户链接、下载小红书无水印图文/视频作品文件、下载笔记内容文本、图片笔记打包下载。
// @author       JoeanAmier 、 BluerAngala
// @match        http*://xhslink.com/*
// @match        http*://www.xiaohongshu.com/explore*
// @match        http*://www.xiaohongshu.com/user/profile/*
// @match        http*://www.xiaohongshu.com/search_result*
// @match        http*://www.xiaohongshu.com/board/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @license      GNU General Public License v3.0

// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// ==/UserScript==



/**
 * 立即执行函数，用于初始化脚本设置和注册菜单命令
 */
(function () {
    // 从GM存储中获取免责声明状态，默认为false
    let disclaimer = GM_getValue("disclaimer", false);

    /**
     * 显示脚本说明和免责声明
     */
    const readme = () => {
        // 脚本使用说明文本
        const instructions = `这是一段介绍`
        // 免责声明文本
        const disclaimer_content = `这是一段免责声明`
        // 显示使用说明
        alert(instructions);
        // 如果用户未同意免责声明
        if (!disclaimer) {
            // 弹出免责声明确认框
            const answer = prompt(disclaimer_content, "");
            if (answer === null) {
                // 用户取消,设置disclaimer为false
                GM_setValue("disclaimer", false);
                disclaimer = false;
            } else {
                // 用户输入YES则设置为true
                GM_setValue("disclaimer", answer.toUpperCase() === "YES");
                disclaimer = GM_getValue("disclaimer");
                location.reload();
            }
        }
    };

    // 首次运行时显示说明
    if (!disclaimer) {
        readme();
    }

    // 注册"关于"菜单命令
    GM_registerMenuCommand("关于 XHS-Downloader", function () {
        readme();
    });

    // 从GM存储获取自动滚动设置,默认为true
    let scroll = GM_getValue("scroll", true);
    scroll = false;

    // 注册切换自动滚动功能的菜单命令
    GM_registerMenuCommand(`自动滚动屏幕功能 ${scroll ? '✔️' : '❌'}`, function () {
        scroll = !scroll;
        GM_setValue("scroll", scroll);
        alert('修改自动滚动屏幕功能成功！');
    });

    // 从GM存储获取滚动检测间隔,默认2500ms
    let timeout = GM_getValue("timeout", 2500);

    // 注册修改滚动检测间隔的菜单命令
    GM_registerMenuCommand("修改滚动检测间隔", function () {
        let data;
        data = prompt("请输入自动滚动屏幕检测间隔：\n如果网络环境不佳导致脚本未能加载全部作品，可以设置较大的检测间隔！", timeout / 1000);
        if (data === null) {
            return
        }
        // 转换为数字,默认2.5秒
        data = parseFloat(data) || 2.5
        timeout = data * 1000;
        GM_setValue("timeout", timeout);
        alert(`修改自动滚动屏幕检测间隔成功，当前值：${data} 秒`);
    });

    // 从GM存储获取滚动次数,默认10次
    let number = GM_getValue("number", 10);

    // 注册修改滚动次数的菜单命令
    GM_registerMenuCommand("修改滚动屏幕次数", function () {
        let data;
        data = prompt("请输入自动滚动屏幕次数：\n仅对提取发现作品、搜索作品、搜索用户链接生效！", number);
        if (data === null) {
            return
        }
        // 转换为整数,默认10次
        number = parseInt(data) || 10;
        GM_setValue("number", number);
        alert(`修改自动滚动屏幕次数成功，当前值：${number} 次`);
    });

    /**
     * 打开项目GitHub页面
     */
    const about = () => {
        window.open('https://github.com/JoeanAmier/XHS-Downloader', '_blank');
    }

    /**
     * 显示下载失败提示
     */
    const abnormal = () => {
        alert("下载无水印作品文件失败！请向作者反馈！\n项目地址：https://github.com/JoeanAmier/XHS-Downloader");
    };

    /**
     * 生成视频下载链接
     * @param {Object} note - 笔记对象
     * @returns {Array} 视频下载链接数组
     */
    const generateVideoUrl = note => {
        try {
            // 从笔记对象中提取视频链接
            return [`https://sns-video-bd.xhscdn.com/${note.video.consumer.originVideoKey}`];
        } catch (error) {
            console.error("Error generating video URL:", error);
            return [];
        }
    };

    /**
     * 生成图片下载链接
     * @param {Object} note - 笔记对象
     * @returns {Array} 图片下载链接数组
     */
    const generateImageUrl = note => {
        let images = note.imageList;
        // 匹配图片ID的正则表达式
        const regex = /http:\/\/sns-webpic-qc\.xhscdn.com\/\d+\/[0-9a-z]+\/(\S+)!/;
        let urls = [];
        try {
            // 遍历所有图片生成下载链接
            images.forEach((item) => {
                let match = item.urlDefault.match(regex);
                if (match && match[1]) {
                    urls.push(`https://ci.xiaohongshu.com/${match[1]}?imageView2/format/png`);
                }
            })
            return urls
        } catch (error) {
            console.error("Error generating image URLs:", error);
            return [];
        }
    };

    /**
     * 下载文件
     * @param {Array} urls - 下载链接数组
     * @param {string} type_ - 文件类型(video/normal)
     */
    const download = async (urls, type_) => {
        // 提取文件名
        const name = extractName();
        console.info(`基础文件名称 ${name}`);

        if (type_ === "video") {
            // 下载视频
            await downloadVideo(urls[0], name);
        } else {
            // 下载图片
            await downloadImage(urls, name);
        }
    };

    // 2024年10月27日18:32:09
    /**
     * 下载文本内容 
     * @param {string} name - 文件名
     */
    const downloadText = (name, zip) => {
        const title = document.querySelector('#detail-title')?.innerText || '';
        const content = document.querySelector('#detail-desc')?.innerText || '';

        if (!title && !content) {
            console.info('未找到文本内容');
            return;
        }

        // 注意，因为小红书文本有很多  表情字符，保存为txt，所以保存为html保证格式准确。
        // 创建HTML内容，添加基本样式
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${name}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                        max-width: 800px;
                        margin: 40px auto;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    h2 { color: #333; }
                    .content { white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <h2>【标题】</h2>
                <div class="content">${title}</div>
                <h2>【正文】</h2>
                <div class="content">${content}</div>
            </body>
            </html>
        `;

        // 将HTML内容添加到zip文件中
        zip.file(`${name}.html`, htmlContent);
        console.info('文本内容已添加到压缩包');
    };


    /**
     * 处理探索页面的下载
     * @param {Object} note - 笔记对象
     */
    const exploreDeal = async note => {
        try {
            let links;

            // 根据类型生成下载链接
            if (note.type === "normal") {
                links = generateImageUrl(note);
            } else {
                links = generateVideoUrl(note);
            }
            // 如果链接数组不为空，则下载文件
            if (links.length > 0) {
                console.info("无水印文件下载链接", links);
                await download(links, note.type);
            } else {
                // 下载失败
                abnormal()
            }
        } catch (error) {
            console.error("Error in deal function:", error);
            abnormal();
        }
    };

    /**
     * 从URL提取笔记信息
     * @returns {Object} 笔记详情对象
     */
    const extractNoteInfo = () => {
        // 匹配笔记ID的正则表达式
        const regex = /\/explore\/([^?]+)/;
        const match = currentUrl.match(regex);
        if (match) {
            return unsafeWindow.__INITIAL_STATE__.note.noteDetailMap[match[1]]
        } else {
            console.error("从链接提取作品 ID 失败", currentUrl,);
        }
    };

    /**
     * 提取下载链接并执行下载
     */
    const extractDownloadLinks = async () => {
        if (currentUrl.includes("https://www.xiaohongshu.com/explore/")) {
            let note = extractNoteInfo();
            if (note.note) {
                await exploreDeal(note.note);
            } else {
                abnormal();
            }
        }
    };

    /**
     * 下载单个文
     * @param {string} link - 下载链接
     * @param {string} filename - 文件名
     * @returns {Promise<Blob>} 文件的Blob对象
     */
    const downloadFile = async (link, filename) => {
        try {
            // 使用 fetch 获取文件数据
            let response = await fetch(link, {
                method: "GET",
            });

            // 检查响应状态码
            if (!response.ok) {
                console.error(`请求失败，状态码: ${response.status}`, response.status);
                return null;
            }

            return await response.blob();
        } catch (error) {
            console.error(`下载失败 (${filename}):`, error);
            return null;
        }
    }

    /**
     * 提取文件名
     * @returns {string} 文件名
     */
    const extractName = () => {
        // 从标题中提取文章笔记内容标题名称
        let name = document.title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
        let match = currentUrl.match(/\/([^\/]+)$/);
        let id = match ? match[1] : null;

        // 提取作者名
        const authorElement = document.querySelector('.name .username');
        const author = authorElement ? authorElement.textContent.trim() : '';

        // 如果作者名不为空，则将作者名添加到文件名中
        author ? name = `${name}_${author}` : name;

        return name === "" ? id : name
    };

    /**
     * 下载视频文件
     * @param {string} url - 视频链接
     * @param {string} name - 文件名
     */
    const downloadVideo = async (url, name) => {
        const blob = await downloadFile(url, `${name}.mp4`);
        if (!blob) {
            abnormal();
            return;
        }

        // 创建下载链接并触发下载
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${name}.mp4`;
        a.click();
        window.URL.revokeObjectURL(blobUrl);
    };

    /**
     * 下载图片文件
     * @param {Array} urls - 图片链接数组
     * @param {string} name - 基础文件名
     */
    const downloadImage = async (urls, name) => {
        // 创建一个JSZip实例
        const zip = new JSZip();

        // 创建一个Promise数组，包含文本和图片的处理
        const promises = [
            // 添加文本内容到zip的Promise
            new Promise((resolve) => {

                // 下载文本内容到zip
                downloadText(name, zip);

                // 下载完成
                resolve(true);
            }),
            // 添加所有图片到zip的Promise数组
            ...urls.map(async (url, index) => {
                const blob = await downloadFile(url, `${index + 1}_${name}.png`);
                if (blob) {
                    zip.file(`${index + 1}_${name}.png`, blob);
                    return true;
                }
                return false;
            })
        ];

        // 等待所有操作完成
        const results = await Promise.all(promises);

        // 检查是否所有操作都成功
        if (!results.every(result => result === true)) {
            abnormal();
            return;
        }

        // 生成zip文件并下载
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const blobUrl = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${name}.zip`;
        a.click();
        window.URL.revokeObjectURL(blobUrl);
    };

    /**
     * 滚动屏幕
     * @param {Function} callback - 滚动完成后的回调函数
     * @param {boolean} endless - 是否无限滚动
     */
    const scrollScreen = (callback, endless = false) => {
        if (!scroll) {
            callback();
        } else if (endless) {
            // 无限滚动直到页面高度不再变化
            let previousHeight = 0;
            const scrollInterval = setInterval(() => {
                const currentHeight = document.body.scrollHeight;
                if (currentHeight !== previousHeight) {
                    window.scrollTo(0, document.body.scrollHeight);
                    previousHeight = currentHeight;
                } else {
                    clearInterval(scrollInterval);
                    callback();
                }
            }, timeout);
        } else {
            // 滚动指定次数
            let previousHeight = 0;
            let scrollCount = 0;
            const scrollInterval = setInterval(() => {
                const currentHeight = document.body.scrollHeight;
                if (currentHeight !== previousHeight && scrollCount < number) {
                    window.scrollTo(0, document.body.scrollHeight);
                    previousHeight = currentHeight;
                    scrollCount++;
                } else {
                    clearInterval(scrollInterval);
                    callback();
                }
            }, timeout);
        }
    };

    /**
     * 提取笔记信息
     * @param {number} order - 笔记类型序号
     * @returns {Array} 笔记ID和token数组
     */
    const extractNotesInfo = order => {
        const notesRawValue = unsafeWindow.__INITIAL_STATE__.user.notes._rawValue[order];
        return notesRawValue.map(item => [item.id, item.xsecToken,]);
    };

    /**
     * 提取专辑信息
     * @param {number} order - 专辑序号
     * @returns {Array} 笔记ID和token数组
     */
    const extractBoardInfo = order => {
        // 定义正则表达式来匹配 URL 中的 ID
        const regex = /\/board\/([a-z0-9]+)\?/;

        // 使用 exec 方法执行正则表达式
        const match = regex.exec(currentUrl);

        // 检查是否有匹配
        if (match) {
            // 提取 ID
            const id = match[1]; // match[0] 是整个匹配的字符串，match[1] 是第一个括号内的匹配

            const notesRawValue = unsafeWindow.__INITIAL_STATE__.board.boardFeedsMap._rawValue[id].notes;
            return notesRawValue.map(item => [item.noteId, item.xsecToken,]);
        } else {
            console.error("从链接提取专辑 ID 失败", currentUrl,);
            return [];
        }
    };

    /**
     * 提取Feed流信息
     * @returns {Array} 笔记ID和token数组
     */
    const extractFeedInfo = () => {
        const notesRawValue = unsafeWindow.__INITIAL_STATE__.feed.feeds._rawValue;
        return notesRawValue.map(item => [item.id, item.xsecToken,]);
    };

    /**
     * 提取搜索笔记信息
     * @returns {Array} 笔记ID和token数组
     */
    const extractSearchNotes = () => {
        const notesRawValue = unsafeWindow.__INITIAL_STATE__.search.feeds._rawValue;
        return notesRawValue.map(item => [item.id, item.xsecToken,]);
    }

    /**
     * 提取搜索用户信息
     * @returns {Array} 用户ID数组
     */
    const extractSearchUsers = () => {
        const notesRawValue = unsafeWindow.__INITIAL_STATE__.search.userLists._rawValue;
        return notesRawValue.map(item => item.id);
    }

    /**
     * 生成笔记链接
     * @param {Array} data - 笔记数据数组
     * @returns {string} 笔记链接字符串
     */
    const generateNoteUrls = data => data.map(([id, token,]) => `https://www.xiaohongshu.com/discovery/item/${id}?source=webshare&xhsshare=pc_web&xsec_token=${token}&xsec_source=pc_share`).join(" ");

    /**
     * 成用户链接
     * @param {Array} data - 用户ID数组
     * @returns {string} 用户链接字符串
     */
    const generateUserUrls = data => data.map(id => `https://www.xiaohongshu.com/user/profile/${id}`).join(" ");

    /**
     * 提取所有链接
     * @param {Function} callback - 提取完成的回调函数
     * @param {number} order - 提取类型序号
     */
    const extractAllLinks = (callback, order) => {
        scrollScreen(() => {
            let data;
            if (order >= 0 && order <= 2) {
                data = extractNotesInfo(order);
            } else if (order === 3) {
                data = extractSearchNotes();
            } else if (order === 4) {
                data = extractSearchUsers();
            } else if (order === -1) {
                data = extractFeedInfo()
            } else if (order === 5) {
                data = extractBoardInfo()
            } else {
                data = [];
            }
            let urlsString = order !== 4 ? generateNoteUrls(data) : generateUserUrls(data);
            callback(urlsString);
        }, [0, 1, 2, 5].includes(order))
    };

    /**
     * 提取链接事件处理
     * @param {number} order - 提取类型序号
     */
    const extractAllLinksEvent = (order = 0) => {
        extractAllLinks(urlsString => {
            if (urlsString) {
                GM_setClipboard(urlsString, "text", () => {
                    alert('作品/用户链接已复制到剪贴板！');
                });
            } else {
                alert("未提取到任何作品/用户链接！")
            }
        }, order);
    };

    /**
     * 创建功能容器
     * @returns {HTMLElement} 功能容器元素
     */
    const createContainer = () => {
        let container = document.createElement('div');
        container.id = 'xhsFunctionContainer';

        let imgTextContainer = document.createElement('div');
        imgTextContainer.id = 'xhsImgTextContainer';

        let img = new Image(48, 48);
        // img.src = "data:image/x-icon;base64,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"
        img.src = 'https://sns-avatar-qc.xhscdn.com/avatar/645b800677c97ef1a2abc7e0.jpg?imageView2/2/w/120/format/jpg'
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';

        let textDiv = document.createElement('div');
        textDiv.id = 'xhsImgTextContainer__text'
        textDiv.textContent = '小红书加强功能';

        imgTextContainer.appendChild(img);
        imgTextContainer.appendChild(textDiv);

        container.appendChild(imgTextContainer);

        document.body.appendChild(container);
        return container;
    };

    /**
     * 创建功能按钮
     * @param {string} id - 按钮ID
     * @param {string} text - 按钮文本
     * @param {Function} onClick - 点击事件处理函数
     * @param {...*} args - 点击事件参数
     * @returns {HTMLElement} 按钮元素
     */
    const createButton = (id, text, onClick, ...args) => {
        let button = document.createElement('button');
        button.id = id;
        button.textContent = text;
        button.addEventListener('click', () => onClick(...args));
        return button;
    };

    // 不需要移除的按钮ID
    const exclusionButton = ["xhsImgTextContainer", "About"];

    /**
     * 更新功能容器
     * @param {Array} buttons - 按钮元素数组
     */
    const updateContainer = buttons => {
        let container = document.getElementById('xhsFunctionContainer');
        if (!container) {
            container = createContainer();
        }

        // 移除除了 imgTextContainer 以外的所有子元素
        Array.from(container.children).forEach(child => {
            if (!exclusionButton.includes(child.id)) {
                child.remove();
            }
        });

        // 添加有效按钮
        buttons.forEach(button => {
            container.appendChild(button);
        });
    };

    // 创建所功能按钮
    const buttons = [
        createButton("Download", "下载无水印作品文件", extractDownloadLinks),
        createButton("Post", "提取发布作品链接", extractAllLinksEvent, 0),
        createButton("Collection", "提取收藏作品链接", extractAllLinksEvent, 1),
        createButton("Favorite", "提取点赞作品链接", extractAllLinksEvent, 2),
        createButton("Feed", "提取发现作品链接", extractAllLinksEvent, -1),
        createButton("Search", "提取搜索作品链接", extractAllLinksEvent, 3),
        createButton("User", "提取搜索用户链接", extractAllLinksEvent, 4),
        createButton("Board", "提取专辑作品链接", extractAllLinksEvent, 5),
        createButton("Disclaimer", "脚本说明及免责声明", readme,),
        createButton("About", "关于 XHS-Downloader", about,),];

    /**
     * 根据URL运行相应功能
     * @param {string} url - 当前页面URL
     */
    const run = url => {
        setTimeout(function () {
            if (!disclaimer) {
            } else if (url === "https://www.xiaohongshu.com/explore" || url.includes("https://www.xiaohongshu.com/explore?")) {
                updateContainer(buttons.slice(4, 5));
            } else if (url.includes("https://www.xiaohongshu.com/explore/")) {
                updateContainer(buttons.slice(0, 1));
            } else if (url.includes("https://www.xiaohongshu.com/user/profile/")) {
                updateContainer(buttons.slice(1, 4));
            } else if (url.includes("https://www.xiaohongshu.com/search_result")) {
                updateContainer(buttons.slice(5, 7));
            } else if (url.includes("https://www.xiaohongshu.com/board/")) {
                updateContainer(buttons.slice(7, 8));
            }
        }, 500)
    }

    // 当前页面URL
    let currentUrl = window.location.href;

    // 初始化显示免责声明按钮
    updateContainer(buttons.slice(8));

    // 初始化容器
    run(currentUrl)

    // 设置 MutationObserver 来监听 URL 变化
    let observer
    if (disclaimer) {
        observer = new MutationObserver(function () {
            if (currentUrl !== window.location.href) {
                currentUrl = window.location.href;
                run(currentUrl);
            }
        });
        const config = { childList: true, subtree: true };
        observer.observe(document.body, config);
    }

    const buttonStyle = `
    #xhsFunctionContainer {
        position: fixed;
        bottom: 15%;
        background-color: #fff;
        color: #2f3542;
        padding: 5px 10px;
        border-radius: 0 32px 32px 0;
        box-shadow: 0 3.2px 12px #00000014, 0 5px 24px #0000000a;
        transition: width 0.25s ease-in-out, border-radius 0.25s ease-in-out, height 0.25s ease-in-out;
        overflow: hidden;
        white-space: nowrap;
        width: 65px; /* 初始宽度 */
        height: 60px;
        text-align: center;
        font-size: 16px;
        display: flex;
        flex-direction: column-reverse;
        z-index: 99999;
    }
    
    #xhsFunctionContainer:hover {
        padding: 10px 10px 5px 10px;
        width: 210px; /* hover时的宽度 */
        height: auto;
    }

    #xhsFunctionContainer button {
        cursor: pointer;
        height: 48px;
        color: #ff4757;
        font-size: 14px;
        font-weight: 600;
        border-radius: 32px;
        margin-bottom: 14px;
        border: 3px #ff4757 solid;
    }
    
    #xhsFunctionContainer button:active {
        background-color: #ff4757; /* 点击时的背景颜色 */
    }
    
    #xhsImgTextContainer {
        display: flex;
        align-items: center;
        gap: 14px;
    }
    
    #xhsImgTextContainer__text {
        font-size: 14px;
        font-weight: 600;
    }
    `;
    /**
     * 创建并添加样式到页面头部
     * @param {string} buttonStyle CSS样式字符串
     * @param {string} disclaimer 免责声明内容
     */

    // 获取页面的head元素,如果不存在则获取head标签集合的第一个元素
    const head = document.head || document.getElementsByTagName('head')[0];

    // 创建style标签元素
    const style = document.createElement('style');

    // 将style标签添加到head中
    head.appendChild(style);

    // 设置style标签的type属性为css
    style.type = 'text/css';

    // 将CSS样式字符串添加到style标签中
    style.appendChild(document.createTextNode(buttonStyle));

    // 在控制台输出用户接受免责声明的信息
    console.info("用户接受 XHS-Downloader 免责声明", disclaimer)
})();



