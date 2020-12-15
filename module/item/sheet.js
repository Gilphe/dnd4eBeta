import TraitSelector from "../apps/trait-selector.js";
import {onManageActiveEffect, prepareActiveEffectCategories} from "../effects.js";

/**
 * Override and extend the core ItemSheet implementation to handle specific item types
 * @extends {ItemSheet}
 */
export default class ItemSheet4e extends ItemSheet {
	constructor(...args) {
		super(...args);
		// Expand the default size of the class sheet
		if ( this.object.data.type === "class" ) {
			this.options.resizable = true;
			this.options.width =  600;
			this.options.height = 680;
		}
	}

  /* -------------------------------------------- */

  /** @override */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      width: 560,
      height: 420,
      classes: ["dnd4eAltus", "sheet", "item"],
      resizable: true,
      scrollY: [".tab.details", ".desk__content", ".scrollbar"],
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "description"}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    const path = "systems/dnd4eAltus/templates/items/";
    return `${path}/${this.item.data.type}.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const data = super.getData(options);
    data.labels = this.item.labels;
    data.config = CONFIG.DND4EALTUS;

    // Item Type, Status, and Details
    data.itemType = data.item.type.titleCase();
    data.itemStatus = this._getItemStatus(data.item);
    data.itemProperties = this._getItemProperties(data.item);
    data.isPhysical = data.item.data.hasOwnProperty("quantity");

    // Potential consumption targets
    data.abilityConsumptionTargets = this._getItemConsumptionTargets(data.item);
	
	if(data.item.type === "atwill" ||
		data.item.type === "encounter" ||
		data.item.type === "daily" ||
		data.item.type === "utility" ) data.powerWeaponUseTargets = this._getItemsWeaponUseTargets(data.item);
	
	if(data.item.type == "equipment") data.equipmentSubTypeTargets = this._getItemEquipmentSubTypeTargets(data.item, data.config);
	
	if(data.data?.useType) {
		if(!(data.data.rangeType === "personal" || data.data.rangeType === "closeBurst" || data.data.rangeType === "closeBlast" || data.data.rangeType === ""))
			data.data.isRange = true;
		if(data.data.rangeType === "closeBurst" || data.data.rangeType === "closeBlast" || data.data.rangeType === "rangeBurst" || data.data.rangeType === "rangeBlast" || data.data.rangeType === "wall" ) 
			data.data.isArea = true;
	}

    // Action Details
    data.hasAttackRoll = this.item.hasAttack;
    data.isHealing = data.item.data.actionType === "heal";
    data.isFlatDC = getProperty(data.item.data, "save.scaling") === "flat";

    // Vehicles
    data.isCrewed = data.item.data.activation?.type === 'crew';
    data.isMountable = this._isItemMountable(data.item);
	
	// Prepare Active Effects
	data.effects = prepareActiveEffectCategories(this.entity.effects);
    return data;
  }


	_getItemEquipmentSubTypeTargets(item, config) {

		if(item.data.armour.type == "armour") { return config.equipmentTypesArmour; }
		else if (item.data.armour.type == "arms") { return config.equipmentTypesArms; }
		else if (item.data.armour.type == "feet") { return config.equipmentTypesFeet; }
		else if (item.data.armour.type == "hands") { return config.equipmentTypesHands; }
		else if (item.data.armour.type == "head") { return config.equipmentTypesHead; }
		else if (item.data.armour.type == "neck") { return config.equipmentTypesNeck; }
		else if (item.data.armour.type == "ring") { return null; }
		else if (item.data.armour.type == "waist") { return config.equipmentTypesWaist; }
		else if (item.data.armour.type == "natural") { return null; }
		else if (item.data.armour.type == "other") { return null; }
		
		return null;
	}
  /* -------------------------------------------- */

  /**
   * Get the valid item consumption targets which exist on the actor
   * @param {Object} item         Item data for the item being displayed
   * @return {{string: string}}   An object of potential consumption targets
   * @private
   */
  _getItemConsumptionTargets(item) {
    const consume = item.data.consume || {};
    if ( !consume.type ) return [];
    const actor = this.item.actor;
    if ( !actor ) return {};
	
    // Ammunition
    if ( consume.type === "ammo" ) {
      return actor.itemTypes.consumable.reduce((ammo, i) =>  {
        if ( i.data.data.consumableType === "ammo" ) {
          ammo[i.id] = `${i.name} (${i.data.data.quantity})`;
        }
        return ammo;
      }, {});
    }

	// Attributes
	else if ( consume.type === "attribute" ) {
		const attributes = Object.values(CombatTrackerConfig.prototype.getAttributeChoices())[0]; // Bit of a hack
		//manualy adding values like a smuck
		attributes.push(
			"actionpoints.value",
			"magicItemUse.dailyuse",
			"details.exp",
			"details.age",
			"details.temphp",
			"details.surgeCur",
			"currency.ad",
			"currency.pp",
			"currency.gp",
			"currency.sp",
			"currency.cp",
			"ritualcomp.ar",
			"ritualcomp.ms",
			"ritualcomp.rh",
			"ritualcomp.si",
			"ritualcomp.rs"
		);

		return attributes.reduce((obj, a) => {
			obj[a] = a;
			return obj;
		}, {});
	}

    // Materials
    else if ( consume.type === "material" ) {
      return actor.items.reduce((obj, i) => {
        if ( ["consumable", "loot"].includes(i.data.type) ) {
          obj[i.id] = `${i.name} (${i.data.data.quantity})`;
        }
        return obj;
      }, {});
    }

    // Charges
    else if ( consume.type === "charges" ) {
      return actor.items.reduce((obj, i) => {
        const uses = i.data.data.uses || {};
        if ( uses.per && uses.max ) {
          const label = uses.per === "charges" ?
            ` (${game.i18n.format("DND4EALTUS.AbilityUseChargesLabel", {value: uses.value})})` :
            ` (${game.i18n.format("DND4EALTUS.AbilityUseConsumableLabel", {max: uses.max, per: uses.per})})`;
          obj[i.id] = i.name + label;
        }
        return obj;
      }, {})
    }
    else return {};
  }
  
    /* -------------------------------------------- */
	
	/**
	* Get the valid weapons targets which exist on the actor
	* @param {Object} weapon         weapon data for the weapon items being displayed
	* @return {{string: string}}   An object of potential consumption targets
	* @private
	*/
	_getItemsWeaponUseTargets(weapon) {
		const weaponType = weapon.data.weaponType || {};
		if ( !weaponType ) return [];
		const actor = this.item.actor;
		if ( !actor ) return {};

		let setMelee = ["melee", "simpleM", "militaryM", "superiorM", "improvM", "naturalM", "siegeM"];
		let setRanged = ["ranged", "simpleR", "militaryR", "superiorR", "improvR", "naturalR", "siegeR"];
		
		if ( weaponType === "melee" ) {
			return actor.itemTypes.weapon.reduce((obj, i) =>  {
				if (setMelee.includes(i.data.data.weaponType) ) {
					obj[i.id] = `${i.name}`;
				}
				return obj;
			}, {});
		}
		
		if ( weaponType === "ranged" ) {
			return actor.itemTypes.weapon.reduce((obj, i) =>  {
				if (setRanged.includes(i.data.data.weaponType) ) {
					obj[i.id] = `${i.name}`;
				}
				return obj;
			}, {});
		}

		if ( weaponType === "meleeRanged" ) {
			return actor.itemTypes.weapon.reduce((obj, i) =>  {
				if (setMelee.includes(i.data.data.weaponType) || setRanged.includes(i.data.data.weaponType) ) {
					obj[i.id] = `${i.name}`;
				}
				return obj;
			}, {});
		}
		
		if ( weaponType === "implement" ) {
			return actor.itemTypes.weapon.reduce((obj, i) =>  {
				if (i.data.data.properties.imp ) {
					obj[i.id] = `${i.name}`;
				}
				return obj;
			}, {});			
		}
				
		if ( weaponType === "implementA" ) {
			return actor.itemTypes.weapon.reduce((obj, i) =>  {
				if (i.data.data.properties.impA || i.data.data.properties.imp ) {
					obj[i.id] = `${i.name}`;
				}
				return obj;
			}, {});			
		}
		
		if ( weaponType === "implementD" ) {
			return actor.itemTypes.weapon.reduce((obj, i) =>  {
				if (i.data.data.properties.impD || i.data.data.properties.imp ) {
					obj[i.id] = `${i.name}`;
				}
				return obj;
			}, {});			
		}
		
		return {};
	}

  /* -------------------------------------------- */

  /**
   * Get the text item status which is shown beneath the Item type in the top-right corner of the sheet
   * @return {string}
   * @private
   */
  _getItemStatus(item) {
    if ( item.type === "spell" ) {
      return CONFIG.DND4EALTUS.spellPreparationModes[item.data.preparation];
    }
    else if ( ["weapon", "equipment"].includes(item.type) ) {
      return game.i18n.localize(item.data.equipped ? "DND4EALTUS.Equipped" : "DND4EALTUS.Unequipped");
    }
    else if ( item.type === "tool" ) {
      return game.i18n.localize(item.data.proficient ? "DND4EALTUS.Proficient" : "DND4EALTUS.NotProficient");
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the Array of item properties which are used in the small sidebar of the description tab
   * @return {Array}
   * @private
   */
  _getItemProperties(item) {
    const props = [];
    const labels = this.item.labels;

    if ( item.type === "weapon" ) {
      props.push(...Object.entries(item.data.properties)
        .filter(e => e[1] === true)
        .map(e => CONFIG.DND4EALTUS.weaponProperties[e[0]]));
    }

    else if ( item.type === "spell" ) {
      props.push(
        labels.components,
        labels.materials,
        item.data.components.concentration ? game.i18n.localize("DND4EALTUS.Concentration") : null,
        item.data.components.ritual ? game.i18n.localize("DND4EALTUS.Ritual") : null
      )
    }

    else if ( item.type === "equipment" ) {
      props.push(CONFIG.DND4EALTUS.equipmentTypes[item.data.armour.type]);
      props.push(labels.armour);
    }

    else if ( item.type === "feat" ) {
      props.push(labels.featType);
    }

    // Action type
    if ( item.data.actionType ) {
      props.push(CONFIG.DND4EALTUS.itemActionTypes[item.data.actionType]);
    }

    // Action usage
    if ( (item.type !== "weapon") && item.data.activation && !isObjectEmpty(item.data.activation) ) {
      props.push(
        labels.activation,
        labels.range,
        labels.target,
        labels.duration
      )
    }
    return props.filter(p => !!p);
  }

  /* -------------------------------------------- */

  /**
   * Is this item a separate large object like a siege engine or vehicle
   * component that is usually mounted on fixtures rather than equipped, and
   * has its own AC and HP.
   * @param item
   * @returns {boolean}
   * @private
   */
  _isItemMountable(item) {
    const data = item.data;
    return (item.type === 'weapon' && data.weaponType === 'siege')
      || (item.type === 'equipment' && data.armour.type === 'vehicle');
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(position={}) {
    position.height = this._tabs[0].active === "details" ? "auto" : this.options.height;
    return super.setPosition(position);
  }

  /* -------------------------------------------- */
  /*  Form Submission                             */
	/* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {

    // TODO: This can be removed once 0.7.x is release channel
    if ( !formData.data ) formData = expandObject(formData);

    // Handle Damage Array
    const damage = formData.data?.damage;
    if ( damage ) damage.parts = Object.values(damage?.parts || {}).map(d => [d[0] || "", d[1] || ""]);
    const damageCrit = formData.data?.damageCrit;
    if ( damageCrit ) damageCrit.parts = Object.values(damageCrit?.parts || {}).map(d => [d[0] || "", d[1] || ""]);
	
    const damageRes = formData.data.armour?.damageRes;
    if ( damageRes ) damageRes.parts = Object.values(damageRes?.parts || {}).map(d => [d[0] || "", d[1] || ""]);
	
    // Update the Item
    super._updateObject(event, formData);
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
	if ( this.isEditable ) {
		html.find(".damage-control").click(this._onDamageControl.bind(this));
		html.find('.trait-selector.class-skills').click(this._onConfigureClassSkills.bind(this));
		html.find(".effect-control").click(ev => {
		if ( this.item.isOwned ) return ui.notifications.warn("Managing Active Effects within an Owned Item is not currently supported and will be added in a subsequent update.")
		onManageActiveEffect(ev, this.item)
	});
	}

  }

  /* -------------------------------------------- */

  /**
   * Add or remove a damage part from the damage formula
   * @param {Event} event     The original click event
   * @return {Promise}
   * @private
   */
  async _onDamageControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new damage component
    if ( a.classList.contains("add-damage") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const damage = this.item.data.data.damage;
      return this.item.update({"data.damage.parts": damage.parts.concat([["", ""]])});
    }

    // Remove a damage component
    if ( a.classList.contains("delete-damage") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const li = a.closest(".damage-part");
      const damage = duplicate(this.item.data.data.damage);
      damage.parts.splice(Number(li.dataset.damagePart), 1);
      return this.item.update({"data.damage.parts": damage.parts});
    }
	
    // Add new critical damage component
    if ( a.classList.contains("add-criticalDamage") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const damageCrit = this.item.data.data.damageCrit;
      return this.item.update({"data.damageCrit.parts": damageCrit.parts.concat([["", ""]])});
    }

    // Remove a critical damage component
    if ( a.classList.contains("delete-criticalDamage") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const li = a.closest(".damage-part");
      const damageCrit = duplicate(this.item.data.data.damageCrit);
      damageCrit.parts.splice(Number(li.dataset.damagePart), 1);
      return this.item.update({"data.damageCrit.parts": damageCrit.parts});
    }
	
    // Add new damage res
    if ( a.classList.contains("add-damageRes") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const damageRes = this.item.data.data.armour.damageRes;
      return this.item.update({"data.armour.damageRes.parts": damageRes.parts.concat([["", ""]])});
    }

    // Remove a damage res
    if ( a.classList.contains("delete-damageRes") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const li = a.closest(".damage-part");
      const damageRes = duplicate(this.item.data.data.armour.damageRes);
      damageRes.parts.splice(Number(li.dataset.damagePart), 1);
      return this.item.update({"data.armour.damageRes.parts": damageRes.parts});
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle spawning the TraitSelector application which allows a checkbox of multiple trait options
   * @param {Event} event   The click event which originated the selection
   * @private
   */
  _onConfigureClassSkills(event) {
    event.preventDefault();
    const skills = this.item.data.data.skills;
    const choices = skills.choices && skills.choices.length ? skills.choices : Object.keys(CONFIG.DND4EALTUS.skills);
    const a = event.currentTarget;
    const label = a.parentElement;

    // Render the Trait Selector dialog
    // new TraitSelector(this.item, {
      // name: a.dataset.edit,
      // title: label.innerText,
      // choices: Object.entries(CONFIG.DND4EALTUS.skills).reduce((obj, e) => {
        // if ( choices.includes(e[0] ) ) obj[e[0]] = e[1];
        // return obj;
      // }, {}),
      // minimum: skills.number,
      // maximum: skills.number
    // }).render(true)
  }
}