import Base64 from './base64.js'
import { Config } from './config.js'
import { geturlparam } from './utils.js'
let PageEx = {
    wrapWebUrl(url, title) {
        if (!url.includes(':/')) {
            url = Config.server + url;
        }
        // url = url.replace(/_token=[^&]*/, '')
        var enurl = Base64.encode(encodeURIComponent(url));
        // console.log(url);
        // console.log(enurl);
        return enurl;
    },

    // 将网页地址转换为小程序地址
    wrapWebUrlToWxaUrl(url) {
        let enurl = this.wrapWebUrl(url);
        return `/pages/index/index?frommain=true&url=${enurl}`;
    },

    // 打开网页
    openWebPage(url) {
        wx.navigateTo({
            url: this.wrapWebUrlToWxaUrl(url),
        })
    },
    gotoWebPage(url) {
        wx.redirectTo({
            url: this.wrapWebUrlToWxaUrl(url),
        })
    },
    autoOpenWebPage(url) {
        if (url) {
            if (url.indexOf("?newtab") > 0 || url.indexOf("&newtab") > 0) {
                return this.openWebPage(url);
            }
            else {
                return this.gotoWebPage(url);
            }
        }
    },

    // 获取当前页面
    getWXaPath() {
        return '/' + this.route + '?' + geturlparam(this.options);
    },

    // 登录并返回当前页面
    loginAndBack() {
        let wxaurl = 'wxa:' + this.getWXaPath();
        let enwxaurl = Base64.encode(encodeURIComponent(wxaurl));
        let token = getApp().getToken();
        let param = geturlparam({
            logingoto: wxaurl,
            _token: token
        });
        let url = `/login.html?${param}`;
        // console.log(url)
        this.gotoWebPage(url)
    },

    getPageKey() {
        let pages = getCurrentPages();
        let page = pages[pages.length - 1];
        let pagekey = page.route.replace(/\//g, '_');
        return pagekey;
    },

    getPageData(key) {
        let pagekey = this.getPageKey();
        let jsondata = wx.getStorageSync(pagekey + "__" + key);
        try {
            return jsondata ? JSON.parse(jsondata)['value'] : null;
        }
        catch (e) {
            return null;
        }
    },
    setPageData(key, data) {
        let pagekey = this.getPageKey();
        let wrapdata = {
            value: data
        };
        try {
            wx.setStorageSync(pagekey + "__" + key, JSON.stringify(wrapdata));
        }
        catch (e) {
            console.error(e);
        }
    },
};
let XPage = function (options) {
    // console.log(options)
    options = Object.assign(options, PageEx);
    // console.log(options)
    // console.log(PageEx)
    return Page(options);
}

export { XPage }