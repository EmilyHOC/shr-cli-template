const fse = require('fs-extra');
const path = require('path')
const formatPath = require('./formatPath');
const npminstall = require('npminstall');
const fs = require('fs')
const log = require('./log')
const npm = require('./npm')

const useOriginNpm = true;

class Package {
    constructor(options) {
        if (!options) {
            throw new Error('Package 类的options参数不能为空')
        }
        //package的目标路径
        this.targetPath = options.targetPath
        //缓存package的路径 （目标路径加上一个node_modules）
        this.storePath = options.storePath
        this.packageName = options.name
        this.packageVersion = options.version
        this.npmFilePathPrefix = this.packageName.replace('/', '_');
    }
    get npmFilePath() {
        return path.resolve(this.storePath, `_${this.npmFilePathPrefix}@${this.packageVersion}@${this.packageName}`);
    }
    getRootFilePath() {
        //获取package.json所在的目录 pkg.dir
        const pkg = this.getPackage()
        if (pkg && (pkg.main)) {
            return formatPath(path.resolve(this.storePath, pkg.main))
        }
        //读取package.json require
        //找到main/lib
        //路径兼容
    }

    getPackage() {
        return fse.readJsonSync(path.resolve(this.storePath, 'package.json'));
    }

    async install() {
        await this.prepare();
        return npminstall({
            root: this.targetPath,
            storeDir: this.storePath,
            registry: npm.getNpmRegistry(useOriginNpm),
            pkgs: [{
                name: this.packageName,
                version: this.packageVersion,
            }],
        });
    }

    async prepare() {
        if (!fs.existsSync(this.targetPath)) {
            fse.mkdirpSync(this.targetPath);
        }
        if (!fs.existsSync(this.storePath)) {
            fse.mkdirpSync(this.storePath);
        }
        log.verbose(this.targetPath);
        log.verbose(this.storePath);
        const latestVersion = await npm.getLatestVersion(this.packageName);
        console.log(latestVersion)
        log.verbose('latestVersion', this.packageName, latestVersion);
        if (latestVersion) {
            this.packageVersion = latestVersion;
        }
    }
    async exists() {
        await this.prepare();
        return fs.existsSync(this.storePath);
    }
    async update() {
        const latestVersion = await this.getLatestVersion();
        console.log(latestVersion,'latest')
        return npminstall({
            root: this.targetPath,
            storeDir: this.storePath,
            registry: npm.getNpmRegistry(useOriginNpm),
            pkgs: [{
                name: this.packageName,
                version: latestVersion,
            }],
        });
    }
    async getLatestVersion() {
        const version = await this.getVersion();
        if (version) {
            const latestVersion = await npm.getNpmLatestSemverVersion(this.packageName, version);
            return latestVersion;
        }
        return null;
    }
    async getVersion() {
        await this.prepare();
        return await this.exists() ? this.getPackage().version : null;
    }


}

module.exports = Package
