/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ added: NonNullable<unknown>, seen: NonNullable<unknown> }} Notif_Device_DatesInputs */



/**
* | output |
* | --- |
* | "Added {added} · last sent {seen}" |
*
* @param {Notif_Device_DatesInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const notif_device_dates = /** @type {((inputs: Notif_Device_DatesInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notif_Device_DatesInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`Added ${i?.added} · last sent ${i?.seen}`)
	return /** @type {LocalizedString} */ (`Ajouté le ${i?.added} · dernier envoi ${i?.seen}`)
});