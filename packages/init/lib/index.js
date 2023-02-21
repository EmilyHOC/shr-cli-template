'use strict';
const {log, inquirer, formatClassName, formatName, exec, spinner, sleep,npm} = require('@shr-cli-template/utils')
const fs = require('fs')
const fse = require('fs-extra')
const {ADD_CODE_TEMPLATE, DEPENDENCIES_PATH, DEFAULT_CLI_HOME} = require('./getProjectTemplate');
const path = require("path");
const {homedir} = require("os");
const pathExists = require('path-exists').sync;
const pkgUp = require('pkg-up')
const npminstall = require('npminstall')
async function init({force}) {
    try {
        // 设置 targetPath
        let targetPath = process.cwd();
        log.verbose('init');
        // 完成项目初始化的准备和校验工作
        const result = await prepare(force);
        if (!result) {
            log.info('创建项目终止');
            return;
        }
        // 获取项目模板列表
        const {templateList, project} = result;
        // 缓存项目模板文件
        const template = await downloadTemplate(templateList);
        log.verbose('template', template);
    } catch (e) {

    } finally {
        process.exit(0);
    }
}

function createTemplateChoice(list) {
    return list.map(item => ({
        value: item.npmName,
        name: item.name,
    }));
}

async function downloadTemplate(templateList) {
    // 用户交互选择
    const templateName = await inquirer({
        choices: createTemplateChoice(templateList),
        message: '请选择项目模板',
    });
    log.verbose('template', templateName);
    const selectedTemplate = templateList.find(item => item.npmName === templateName);
    log.verbose('selected template', selectedTemplate);
    const targetPath = path.resolve(`${homedir()}/${DEFAULT_CLI_HOME}`, 'addTemplate');
    await  updateOrInstall(targetPath,selectedTemplate)
    const rootDir = process.cwd()
    //文件复制
    await copyCodeToDes(targetPath, rootDir, selectedTemplate)
    // 依赖安装
    await dependencyInit(targetPath, selectedTemplate)

}

async function dependencyInit(targetPath, selectedTemplate){
    const rootDir = process.cwd()
    const targetPathPkgJson = require(await pkgUp({cwd: `${cacheFilePath(targetPath, selectedTemplate)}`}))
    const rootDirPkgJson = require(await pkgUp())
    // 依赖项对比
    const diffDependencies = await dependencyDiff(targetPathPkgJson.dependencies, rootDirPkgJson.dependencies, 'dependencies')
    log.verbose('依赖项 dependencies 对比', diffDependencies)
    if (diffDependencies && diffDependencies.length > 0) {
        // 安装 dependencies 依赖
        await writeDependency(diffDependencies, await pkgUp())
        log.success('当前项目中dependencies已经是最新依赖');
        await addNpminstall(rootDir)
        log.success('下载依赖成功');
    } else {
        log.warn('请手动安装依赖');
        return
    }
}

// 依赖对比
function dependencyDiff(template, origin, type) {
    if (template && origin) {
        return objToArr(template)
    } else if (template) {
        return objToArr(template)
    } else {
        return
    }
}

// 对象转数组
function objToArr(object) {
    const arr = []
    for (let key in object) {
        const obj = {}
        obj[key] = object[key]
        arr.push(obj)
    }
    return arr
}
function copyCodeToDes(targetPath, rootDir, selectedTemplate){
    fse.copySync(`${cacheFilePath(targetPath, selectedTemplate)}`, `${rootDir}`);
}

// 将依赖写入package.json文件
async function writeDependency(dependencyList, targetPath) {
    const data = JSON.parse(fs.readFileSync(targetPath, 'utf-8'))
    dependencyList.map((item) => {
        data.dependencies[Object.keys(item)[0]] = Object.values(item)[0]
    })
    fs.writeFileSync(targetPath, JSON.stringify(data), 'utf-8')
}
// 安装依赖
async function addNpminstall(targetPath) {
    return new Promise((resolve, reject) => {
        const p = exec('npm', ['install', '--registry=https://registry.npm.taobao.org',], {
            stdio: 'inherit', cwd: targetPath
        });
        p.on('error', e => {
            reject(e);
        });
        p.on('exit', c => {
            resolve(c);
        });
    });
}
async function updateOrInstall(targetPath, selectedTemplate) {
    const installOrUpdataFlag = await cacheFile(targetPath, selectedTemplate)
    if (installOrUpdataFlag === 'install') {
        let spinnerStart = spinner(`正在下载模板...`);
        await sleep(1000);
        await installAddTemplate(targetPath, selectedTemplate)
        spinnerStart.stop(true);
        log.success('下载模板成功');
    } else if (installOrUpdataFlag === 'update') {
        let spinnerStart = spinner(`正在更新模板...`);
        await sleep(1000);
        await updateAddTemplate(targetPath, selectedTemplate)
        spinnerStart.stop(true);
        log.success('更新模板成功');
    } else {
        log.success('模版文件中已经是最新版本')
    }
}
async function updateAddTemplate(targetPath, template) {
    await installAddTemplate(targetPath, template)
}

async function cacheFile(targetPath, template) {
    const {npmName} = template
    // 判断本地缓存文件是否存在，如果不存在缓存文件就创建缓存文件执行安装逻辑，
    // 如果缓存文件存在，但是没有模版文件，也需要重新安装。
    // 如果存在缓存模版文件就针对版本信息进行文件查找，如果是最新版本就退出，执行拷贝命令，否则执行更新逻辑
    if (!pathExists(targetPath)) {
        fse.mkdirpSync(targetPath)
        return 'install'
    } else {
        const cacheFilePathTemplate = await cacheFilePath(targetPath, template)
        // 如果存在当前版本文件就直接返回
        if (pathExists(cacheFilePathTemplate)) {
            return 'none'
        }
        const filfList = await readCacheFile(targetPath, npmName)
        // 如果有旧版本文件就直接更新，否则就执行安装逻辑
        if (filfList && filfList.length > 0) {
            return 'update'
        } else {
            return 'install'
        }

    }
}

function readCacheFile(path, templateName) {
    const fileList = []
    const files = fs.readdirSync(path);
    files.map((items) => {
        if (items.indexOf(templateName.replace('/', '_')) != -1)
            fileList.push(items)
    })
    return fileList
}

function cacheFilePath(targetPath, template) {
    const {npmName, version} = template
    return path.resolve(targetPath, `_${npmName.replace('/', '_')}@${version}@${npmName}`);
}
// 安装模版
function installAddTemplate(targetPath, template) {
    const {npmName, templateVersion} = template
    return npminstall({
        root: targetPath,
        storeDir: targetPath,
        registry: npm.getNpmRegistry(true),
        pkgs: [{
            name: npmName,
            version: templateVersion,
        }],
    });
}

async function prepare(force) {
    let fileList = fs.readdirSync(process.cwd());
    fileList = fileList.filter(file => ['node_modules', '.git', '.DS_Store'].indexOf(file) < 0);
    log.verbose('fileList', fileList);
    let continueWhenDirNotEmpty = true;
    if (fileList && fileList.length > 0) {
        continueWhenDirNotEmpty = await inquirer({
            type: 'confirm',
            message: '当前文件夹不为空，是否继续创建项目？',
            defaultValue: false,
        });
    }
    if (!continueWhenDirNotEmpty) {
        return;
    }
    if (force) {
        const targetDir = process.cwd();
        const confirmEmptyDir = await inquirer({
            type: 'confirm',
            message: '是否确认清空当下目录下的文件',
            defaultValue: false,
        });
        if (confirmEmptyDir) {
            fse.emptyDirSync(targetDir);
        }
    }
    let templateList = ADD_CODE_TEMPLATE
    let projectName = '';
    let className = '';
    while (!projectName) {
        projectName = await getProjectName();
        if (projectName) {
            projectName = formatName(projectName);
            className = formatClassName(projectName);
        }
        log.verbose('name', projectName);
        log.verbose('className', className);
    }
    let version = '1.0.0';
    do {
        version = await getProjectVersion(version);
        log.verbose('version', version);
    } while (!version);
    return {
        templateList,
        project: {
            name: projectName,
            className,
            version,
        },
    };

}

function getProjectVersion(defaultVersion) {
    return inquirer({
        type: 'string',
        message: '请输入项目版本号',
        defaultValue: defaultVersion,
    });
}

function getProjectName() {
    return inquirer({
        type: 'string',
        message: '请输入项目名称',
        defaultValue: '',
    });
}

module.exports = init

