/* eslint-disable */
import * as registry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Offline_PendingInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} change waiting to sync" |
* | * | "{count} changes waiting to sync" |
*
* @param {Offline_PendingInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const offline_pending = /** @type {((inputs: Offline_PendingInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Offline_PendingInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = registry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} change waiting to sync`);
		return /** @type {LocalizedString} */ (`${i?.count} changes waiting to sync`)
	}
	{
		const countPlural = registry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} geste en attente`);
		return /** @type {LocalizedString} */ (`${i?.count} gestes en attente`)
	}
});