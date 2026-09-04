#!/usr/bin/env node
'use strict';

// MeshCommander Automation Worker V0.1
// Isolated sidecar: it never edits MeshCentral files or database directly.
// Default is DRY-RUN. Command execution requires BOTH config.dryRun=false and
// MCA_ALLOW_EXECUTION=YES_I_UNDERSTAND.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const configPath = process.env.MCA_CONFIG || path.join(__dirname, 'rules.json');
const meshRoot = process.env.MESHCENTRAL_ROOT || '/home/administrator/meshcentral';
const meshctrl = process.env.MESHCTRL_PATH || path.join(meshRoot, 'node_modules', 'meshcentral', 'meshctrl.js');
const nodeBin = process.execPath;

function fail(msg) { console.error('[automation] ERROR:', msg); process.exit(1); }
function readConfig() { try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { fail('cannot read ' + configPath + ': ' + e.message); } }
function log(type, data) { console.log(JSON.stringify(Object.assign({ ts:new Date().toISOString(), type:type }, data || {}))); }
function value(v) { return (v == null) ? '' : String(v); }
function nodeId(d) { return d && (d._id || d.id || d.nodeid); }
function nodeIp(d) { return value(d && (d.ip || d.ipaddr || d.addr || d.host)); }
function online(d) { return Number(d && d.conn || 0) > 0; }

function authArgs(cfg) {
  const out = [];
  const url = process.env.MCA_URL || cfg.url;
  const user = process.env.MCA_USER || cfg.loginUser;
  const pass = process.env.MCA_PASS;
  const keyFile = process.env.MCA_LOGIN_KEY_FILE || cfg.loginKeyFile;
  const domain = process.env.MCA_DOMAIN || cfg.domain;
  if (url) out.push('--url', url);
  if (user) out.push('--loginuser', user);
  if (keyFile) out.push('--loginkeyfile', keyFile);
  else if (pass) out.push('--loginpass', pass);
  if (domain) out.push('--domain', domain);
  return out;
}

function meshctrlCall(actionArgs, cfg) {
  return new Promise((resolve, reject) => {
    execFile(nodeBin, [meshctrl].concat(actionArgs).concat(authArgs(cfg)), { timeout: 120000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message || '').trim()));
      resolve((stdout || '').trim());
    });
  });
}

async function listDevices(cfg) {
  const raw = await meshctrlCall(['listdevices', '--json'], cfg);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.devices)) return parsed.devices;
    return Object.keys(parsed || {}).map(k => parsed[k]).filter(x => x && typeof x === 'object');
  } catch (e) {
    throw new Error('listdevices did not return valid JSON: ' + e.message);
  }
}

function matchCondition(rule, d) {
  const c = rule.condition || {};
  if (c.type === 'offline') return !online(d);
  if (c.type === 'online') return online(d);
  if (c.type === 'noagent') return !d.agent;
  if (c.type === 'amtmissing') return !d.intelamt;
  if (c.type === 'subnet') return nodeIp(d).startsWith(value(c.prefix));
  if (c.type === 'nameRegex') {
    try { return new RegExp(c.pattern, c.flags || 'i').test(value(d.name || d.host)); } catch (e) { return false; }
  }
  return false;
}

const cooldowns = new Map();
function cooldownKey(rule, d) { return value(rule.id) + '|' + value(nodeId(d)); }
function cooldownReady(rule, d) {
  const ms = Math.max(60, Number(rule.cooldownSeconds || 900)) * 1000;
  const key = cooldownKey(rule, d), last = cooldowns.get(key) || 0;
  if (Date.now() - last < ms) return false;
  cooldowns.set(key, Date.now());
  return true;
}

function executionEnabled(cfg) {
  return cfg.dryRun === false && process.env.MCA_ALLOW_EXECUTION === 'YES_I_UNDERSTAND';
}

async function executeAction(rule, d, cfg) {
  const action = rule.action || { type:'log' };
  const base = { rule:rule.id, ruleName:rule.name, nodeid:nodeId(d), name:d.name || d.host, action:action.type };
  if (!executionEnabled(cfg) || action.type === 'log') {
    log('dry-run-match', Object.assign(base, { wouldExecute:action }));
    return;
  }
  if (!nodeId(d)) { log('skip', Object.assign(base, { reason:'missing-nodeid' })); return; }

  if (action.type === 'runcommand') {
    if (!action.command) { log('skip', Object.assign(base, { reason:'empty-command' })); return; }
    const args = ['runcommand', '--id', nodeId(d), '--run', action.command, '--reply'];
    if (action.powershell) args.push('--powershell');
    if (action.runAsUser) args.push('--runasuser');
    const output = await meshctrlCall(args, cfg);
    log('executed', Object.assign(base, { output:output.slice(0, 4000) }));
    return;
  }

  // Actions such as ticket creation, move-to-group and notifications are kept
  // disabled until their exact integration contract is configured and tested.
  log('blocked-action', Object.assign(base, { reason:'action-not-allowlisted-in-v0.1' }));
}

async function cycle(cfg) {
  const devices = await listDevices(cfg);
  const rules = (cfg.rules || []).filter(r => r && r.enabled !== false);
  let matches = 0;
  for (const rule of rules) {
    for (const d of devices) {
      if (!matchCondition(rule, d)) continue;
      matches++;
      if (!cooldownReady(rule, d)) continue;
      try { await executeAction(rule, d, cfg); }
      catch (e) { log('action-error', { rule:rule.id, nodeid:nodeId(d), error:e.message }); }
    }
  }
  log('cycle', { devices:devices.length, rules:rules.length, matches:matches, executionEnabled:executionEnabled(cfg) });
}

async function main() {
  if (!fs.existsSync(meshctrl)) fail('meshctrl.js not found: ' + meshctrl);
  const cfg = readConfig();
  const interval = Math.max(60, Number(cfg.intervalSeconds || 60)) * 1000;
  log('start', { config:configPath, meshctrl:meshctrl, intervalSeconds:interval/1000, executionEnabled:executionEnabled(cfg) });
  try { await cycle(cfg); } catch (e) { log('cycle-error', { error:e.message }); }
  setInterval(async () => {
    const next = readConfig();
    try { await cycle(next); } catch (e) { log('cycle-error', { error:e.message }); }
  }, interval);
}

main();
