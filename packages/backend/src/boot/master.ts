/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import * as os from 'node:os';
import cluster from 'node:cluster';
import chalk from 'chalk';
import chalkTemplate from 'chalk-template';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import Logger from '@/logger.js';
import { loadConfig } from '@/config.js';
import type { Config } from '@/config.js';
import { showMachineInfo } from '@/misc/show-machine-info.js';
import { envOption } from '@/env.js';
import { jobQueue, server } from './common.js';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

const meta = JSON.parse(fs.readFileSync(`${_dirname}/../../../../built/meta.json`, 'utf-8'));

const logger = new Logger('core', 'cyan');
const bootLogger = logger.createSubLogger('boot', 'magenta');

const themeColor = chalk.hex('#ffa9c3');

function greet() {
	if (!envOption.quiet) {
		//#region CherryPick logo
		const v = `v${meta.version}`;
		console.log(chalk.hex('#ffa9c3').bold('  _________ .__                                ') + chalk.hex('#95e3e8').bold('__________.__        __    '));
		console.log(chalk.hex('#ffa9c3').bold(' \\_   ___ \\|  |__   __________________ ___.__.') + chalk.hex('#95e3e8').bold('\\______   \\__| ____ |  | __'));
		console.log(chalk.hex('#ffa9c3').bold(' /    \\  \\/|  |  \\_/ __ \\_  __ \\_  __ <   |  |') + chalk.hex('#95e3e8').bold(' |     ___/  |/ ___\\|  |/ /'));
		console.log(chalk.hex('#ffa9c3').bold(' \\     \\___|   Y  \\  ___/|  | \\/|  | \\/\\___  |') + chalk.hex('#95e3e8').bold(' |    |   |  \\  \\___|    < '));
		console.log(chalk.hex('#ffa9c3').bold('  \\______  /___|  /\\___  >__|   |__|   / ____|') + chalk.hex('#95e3e8').bold(' |____|   |__|\\___  >__|_ \\'));
		console.log(chalk.hex('#ffa9c3').bold('         \\/     \\/     \\/              \\/     ') + chalk.hex('#95e3e8').bold('                  \\/     \\/'));
		//#endregion

		console.log(chalk.hex('#ffa9c3').bold(' Cherry') + chalk.hex('#95e3e8').bold('Pick') + (' is an open-source decentralized microblogging platform based from') + (chalk.hex('#9ec23f').bold(' Misskey') + ('.')));
		console.log(chalk.hex('#ffbb00')(' If you like ') + chalk.hex('#ffa9c3').bold('Cherry') + chalk.hex('#95e3e8').bold('Pick') + chalk.hex('#ffbb00')(', please donate to support development. https://www.patreon.com/noridev & https://www.paypal.me/noridev & https://toss.me/noridev'));
		// console.log(chalk.hex('#ffa9c3').bold(' KOKO') + chalk.hex('#95e3e8').bold('NECT') + chalk.hex('#ffa9c3')(' with') + chalk.hex('#95e3e8').bold(' NoriDev.'));

		console.log('');
		console.log(chalkTemplate`--- ${os.hostname()} {gray (PID: ${process.pid.toString()})} ---`);
	}

	bootLogger.info('Welcome to CherryPick!');
	bootLogger.info(`CherryPick v${meta.version}`, null, true);
	bootLogger.info(`Based on Misskey v${meta.basedMisskeyVersion}`, null, true);
}

/**
 * Init master process
 */
export async function masterMain() {
	let config!: Config;

	// initialize app
	try {
		greet();
		showEnvironment();
		await showMachineInfo(bootLogger);
		showNodejsVersion();
		config = loadConfigBoot();
		//await connectDb();
		if (config.pidFile) fs.writeFileSync(config.pidFile, process.pid.toString());
	} catch (e) {
		bootLogger.error('Fatal error occurred during initialization', null, true);
		process.exit(1);
	}

	bootLogger.succ(chalk.hex('#ffa9c3')('Cherry') + chalk.hex('#95e3e8')('Pick') + (' initialized'));

	if (config.sentryForBackend) {
		Sentry.init({
			integrations: [
				...(config.sentryForBackend.enableNodeProfiling ? [nodeProfilingIntegration()] : []),
			],

			// Performance Monitoring
			tracesSampleRate: 1.0, //  Capture 100% of the transactions

			// Set sampling rate for profiling - this is relative to tracesSampleRate
			profilesSampleRate: 1.0,

			maxBreadcrumbs: 0,

			...config.sentryForBackend.options,
		});
	}

	if (envOption.disableClustering) {
		if (envOption.onlyServer) {
			await server();
		} else if (envOption.onlyQueue) {
			await jobQueue();
		} else {
			await server();
			await jobQueue();
		}
	} else {
		if (envOption.onlyServer) {
			// nop
		} else if (envOption.onlyQueue) {
			// nop
		} else {
			await server();
		}

		await spawnWorkers(config.clusterLimit);
	}

	if (envOption.onlyQueue) {
		bootLogger.succ('Queue started', null, true);
	} else {
		bootLogger.succ(config.socket ? `Now listening on socket ${config.socket} on ${config.url}` : `Now listening on port ${config.port} on ${config.url}`, null, true);
	}
}

function showEnvironment(): void {
	const env = process.env.NODE_ENV;
	const logger = bootLogger.createSubLogger('env');
	logger.info(typeof env === 'undefined' ? 'NODE_ENV is not set' : `NODE_ENV: ${env}`);

	if (env !== 'production') {
		logger.warn('The environment is not in production mode.');
		logger.warn('DO NOT USE FOR PRODUCTION PURPOSE!', null, true);
	}
}

function showNodejsVersion(): void {
	const nodejsLogger = bootLogger.createSubLogger('nodejs');

	nodejsLogger.info(`Version ${process.version} detected.`);
}

function loadConfigBoot(): Config {
	const configLogger = bootLogger.createSubLogger('config');
	let config;

	try {
		config = loadConfig();
	} catch (exception) {
		if (typeof exception === 'string') {
			configLogger.error(exception);
			process.exit(1);
		} else if ((exception as any).code === 'ENOENT') {
			configLogger.error('Configuration file not found', null, true);
			process.exit(1);
		}
		throw exception;
	}

	configLogger.succ('Loaded');

	return config;
}

/*
async function connectDb(): Promise<void> {
	const dbLogger = bootLogger.createSubLogger('db');

	// Try to connect to DB
	try {
		dbLogger.info('Connecting...');
		await initDb();
		const v = await db.query('SHOW server_version').then(x => x[0].server_version);
		dbLogger.succ(`Connected: v${v}`);
	} catch (err) {
		dbLogger.error('Cannot connect', null, true);
		dbLogger.error(err);
		process.exit(1);
	}
}
*/

async function spawnWorkers(limit = 1) {
	const workers = Math.min(limit, os.cpus().length);
	bootLogger.info(`Starting ${workers} worker${workers === 1 ? '' : 's'}...`);
	await Promise.all([...Array(workers)].map(spawnWorker));
	bootLogger.succ('All workers started');
}

function spawnWorker(): Promise<void> {
	return new Promise(res => {
		const worker = cluster.fork();
		worker.on('message', message => {
			if (message === 'listenFailed') {
				bootLogger.error('The server Listen failed due to the previous error.');
				process.exit(1);
			}
			if (message !== 'ready') return;
			res();
		});
	});
}
