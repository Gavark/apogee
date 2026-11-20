/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ wine: NonNullable<unknown> }} Dev_Sg_Toast_Action_MsgInputs */



/**
* | output |
* | --- |
* | "{wine} marked as drunk." |
*
* @param {Dev_Sg_Toast_Action_MsgInputs} inputs
* @param {{ locale?: "fr" | "en" }} options
* @returns {LocalizedString}
*/
export const dev_sg_toast_action_msg = /** @type {((inputs: Dev_Sg_Toast_Action_MsgInputs, options?: { locale?: "fr" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dev_Sg_Toast_Action_MsgInputs, { locale?: "fr" | "en" }, {}>} */ ((i, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return /** @type {LocalizedString} */ (`${i?.wine} marked as drunk.`)
	return /** @type {LocalizedString} */ (`${i?.wine} marqué comme bu.`)
});