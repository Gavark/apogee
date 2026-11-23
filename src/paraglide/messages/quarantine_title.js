/* eslint-disable */
import * as __paraglideRegistry from '../registry.js'
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Quarantine_TitleInputs */



/**
* | countPlural | output |
* | --- | --- |
* | "one" | "{count} change could not be sent" |
* | * | "{count} changes could not be sent" |
*
* @param {Quarantine_TitleInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const quarantine_title = /** @type {((inputs: Quarantine_TitleInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quarantine_TitleInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") {
		const countPlural = __paraglideRegistry.plural("en", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} change could not be sent`);
		return /** @type {LocalizedString} */ (`${i?.count} changes could not be sent`)
	}
	{
		const countPlural = __paraglideRegistry.plural("fr", i?.count, {}, true);
		if (countPlural === "one") return /** @type {LocalizedString} */ (`${i?.count} geste n'a pas pu être envoyé`);
		return /** @type {LocalizedString} */ (`${i?.count} gestes n'ont pas pu être envoyés`)
	}
});