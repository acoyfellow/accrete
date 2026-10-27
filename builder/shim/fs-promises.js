import fs from './fs.js';

export const { readFile, writeFile, appendFile, stat, lstat, access, readdir, mkdir, realpath, unlink, rm } = fs.promises;
export default fs.promises;
