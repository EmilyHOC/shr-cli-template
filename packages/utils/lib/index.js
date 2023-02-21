const log = require('./log');
const locale = require('./Locale/loadLocale')
const npm = require('./npm')
const Package = require('./Package')
const chileProcess = require('child_process')
const inquirer = require('./inquirer')
const spinner = require('./spinner');
function exec(command, args, options) {
    const win32 = process.platform === 'win32';

    const cmd = win32 ? 'cmd' : command;
    const cmdArgs = win32 ? ['/c'].concat(command, args) : args;

    return chileProcess.spawn(cmd, cmdArgs, options || {});
}

function sleep(timeout) {
    return new Promise((resolve => {
        setTimeout(resolve, timeout);
    }));
}
function formatName(name) {
    if (name) {
        name = `${name}`.trim();
        if (name) {
            if (/^[.*_\/\\()&^!@#$%+=?<>~`\s]/.test(name)) {
                name = name.replace(/^[.*_\/\\()&^!@#$%+=?<>~`\s]+/g, '');
            }
            if (/^[0-9]+/.test(name)) {
                name = name.replace(/^[0-9]+/, '');
            }
            if (/[.*_\/\\()&^!@#$%+=?<>~`\s]/.test(name)) {
                name = name.replace(/[.*_\/\\()&^!@#$%+=?<>~`\s]/g, '-');
            }
            return camelTrans(name, true);
        } else {
            return name;
        }
    } else {
        return name;
    }
}
function camelTrans(str, isBig) {
    let i = isBig ? 0 : 1;
    str = str.split('-');
    for (; i < str.length; i += 1) {
        str[i] = firstUpperCase(str[i]);
    }
    return str.join('');
}
function firstUpperCase(str) {
    return str.replace(/^\S/, s => s.toUpperCase());
}

function formatClassName(name) {
    return require('kebab-case')(name).replace(/^-/, '');
}
module.exports = {
    log,
    locale,
    npm,
    Package,
    inquirer,
    spinner,
    sleep,
    exec,
    formatName,
    formatClassName
}

