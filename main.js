chrome.runtime.getPlatformInfo(function(info) {
  if (info.os != 'cros') {
    return;
  }

  init_chrome_unikey();
});

var init_chrome_unikey = function() {
  var ime_api = chrome.input.ime;
  var context_id = -1;
  var INPUT_METHOD_KEYS; // switch chars need capture by current input method
  var shift_had_pressed = false;

  var unikey = new Module.SimpleUnikey();

  const KEY_SPELLCHECK = "spellcheck";
  const KEY_AUTORESTORE = "auto_restore_non_vn";
  const KEY_MODERN_STYLE = "modern_style";

  var unikey_opts = {
    spellcheck: false,
    auto_restore_non_vn: false,
    modern_style: false,
  };

  var MENU_ITEMS = {}
  MENU_ITEMS[KEY_SPELLCHECK] = {
    id: KEY_SPELLCHECK,
    label: "Spellcheck",
    style: "check",
    checked: false,
  }
  MENU_ITEMS[KEY_AUTORESTORE] = {
    id: KEY_AUTORESTORE,
    label: "Auto restore non Vietnamese",
    style: "check",
    checked: false,
  }
  MENU_ITEMS[KEY_MODERN_STYLE] = {
    id: KEY_MODERN_STYLE,
    label: "Modern style (oà, uý)",
    style: "check",
    checked: false,
  }

  var MENU = {
    "items": [
      MENU_ITEMS[KEY_SPELLCHECK],
      MENU_ITEMS[KEY_AUTORESTORE],
      MENU_ITEMS[KEY_MODERN_STYLE],
    ],
  };

  var updateMenuItems = function() {
    for (var k in unikey_opts) {
      MENU_ITEMS[k].checked = unikey_opts[k];
    }

    if (MENU.engineID) {
      ime_api.updateMenuItems(MENU);
    }
  }

  chrome.storage.sync.get(['unikey_options'], function(result) {
    if (!'unikey_options' in result) {
      return
    }
    var new_opts = result.unikey_options;
    for (var k in new_opts) {
      unikey_opts[k] = new_opts[k];
    }
    updateMenuItems();
  });

  ime_api.onFocus.addListener(function(context) {
    context_id = context.contextID;
    unikey.reset()
  });

  ime_api.onActivate.addListener(function(engineID) {
    if (engineID == "unikey-telex") {
      INPUT_METHOD_KEYS = /^[a-zA-Z]$/;
      unikey.set_input_method(Module.InputMethod.TELEX);
    } else {
      INPUT_METHOD_KEYS = /^[a-zA-Z0-9]$/;
      unikey.set_input_method(Module.InputMethod.VNI);
    }

    MENU["engineID"] = engineID;
    ime_api.setMenuItems(MENU);
    unikey.set_options(unikey_opts);
  });

  ime_api.onBlur.addListener(function(contextID) {
      context_id = -1
  });

  var update_composition = function() {
    var r = unikey.get_result();
    ime_api.setComposition({
      "contextID": context_id,
      "text": r,
      "cursor": r.length,
    });
  }

  ime_api.onKeyEvent.addListener(function(engineID, keyData) {
    if (keyData.type != "keydown") {
      if (keyData.key == "Shift") {
        shift_had_pressed = false;
      }
      return false;
    }

    if (keyData.key == "Shift") {
      if (shift_had_pressed && unikey.get_result() != "") {
        unikey.restore();
        update_composition();
      } else {
        shift_had_pressed = true;
      }
      return false;
    }

    if (keyData.key == "Backspace" && unikey.get_result() != "") {
      unikey.process_backspace();
      update_composition();
      return true;
    }

    if (!keyData.ctrlKey && keyData.key.match(INPUT_METHOD_KEYS)) {
      unikey.process_char(keyData.key.charCodeAt(0));
      var r = unikey.get_result();
      ime_api.setComposition({
        "contextID": context_id,
        "text": r,
        "cursor": r.length,
      });
      return true;
    }

    if (keyData.code.match(/(AudioVolume|Brightness)/)) {
      return false;
    }

    if (keyData.key == ' ' && unikey_opts[KEY_AUTORESTORE]) {
      unikey.process_char(keyData.key.charCodeAt(0));
      ime_api.commitText({
        "contextID": context_id,
        "text": unikey.get_result(),
      });
      unikey.reset();
      return true;
    }

    // console.log(keyData);

    ime_api.commitText({
      "contextID": context_id,
      "text": unikey.get_result(),
    });
    unikey.reset();

    return false;
  });


  ime_api.onMenuItemActivated.addListener(function(engineID, menu_id) {
    if (menu_id == KEY_SPELLCHECK) {
      unikey_opts[menu_id] = !unikey_opts[menu_id];
      if (!unikey_opts[menu_id]) {
        unikey_opts[KEY_AUTORESTORE] = false;
      }
    } else if (menu_id == KEY_AUTORESTORE) {
      unikey_opts[menu_id] = !unikey_opts[menu_id];
      if (unikey_opts[menu_id]) {
        unikey_opts[KEY_SPELLCHECK] = true;
      }
    } else if (menu_id == KEY_MODERN_STYLE) {
      unikey_opts[menu_id] = !unikey_opts[menu_id];
    }

    updateMenuItems();
    unikey.set_options(unikey_opts);
    var save_opts = {};
    for (var k in unikey_opts) {
      if (unikey_opts[k] == true)
        save_opts[k] = true;
    }
    chrome.storage.sync.set({unikey_options: save_opts});
  });
}
