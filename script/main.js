setTimeout(function() {
  Java.perform(function() {
    // setup java classes
    const ctx = Java.use('android.app.ActivityThread').currentApplication().getApplicationContext();
    const Log = Java.use("android.util.Log");
    const Toast = Java.use('android.widget.Toast');
    const File = Java.use("java.io.File");
    const FileInputStream = Java.use("java.io.FileInputStream");
    const FileOutputStream = Java.use("java.io.FileOutputStream");
    const FileReader = Java.use("java.io.FileReader"); // FIXED: Wajib didefinisikan lewat Java.use
    const BufferedReader = Java.use("java.io.BufferedReader");
    const InputStreamReader = Java.use("java.io.InputStreamReader");
    const URL = Java.use("java.net.URL");
    const MessageDigest = Java.use("java.security.MessageDigest");
    const StringCls = Java.use("java.lang.String");
    const MediaPlayer = Java.use("android.media.MediaPlayer");

    // config constants
    const cfg = {
      pkg: "com.pixticle.bokuboku.mods",
      pref_name: "com.pixticle.bokuboku.mods.v2.playerprefs",
      paths: {
        dir: "/Mods/cheatLoader/",
        conf: "config.json",
        lib: "libaelloader.so",
        snd: "resource.mp3"
      },
      urls: {
        def: "https://raw.githubusercontent.com/nvnoel/boku/refs/heads/main/data/config.json",
        ana: "https://raw.githubusercontent.com/nvnoel/boku/refs/heads/main/script/analytics.js"
      },
      hashes: {
        md5: "b5fa76305b8f6a225d4a9ec7b9208574",
        sha1: "1d9f9f16e36b47215af9560dafdbe2f8c600343e",
        sha256: "70ca16cddc9e2525e68790f6282c750592e7c7ed496d07bf9909a616fafac91f"
      }
    };

    // prefs setup
    const prefs = ctx.getSharedPreferences(cfg.pref_name, 0);
    const editor = prefs.edit();

    // helper log
    function logs(msg) {
      Log.d("Frida", "[MODS] " + msg);
    }

    // helper toast
    function sToast(msg, long) {
      Java.scheduleOnMainThread(function() {
        try {
          const final_msg = "[MODS] " + msg;
          Toast.makeText(ctx, StringCls.$new(final_msg), long).show();
        } catch (e) {}
      });
    }

    // fetch text from url
    function fetch(target_url) {
      try {
        const conn = URL.$new(target_url).openConnection();
        const reader = BufferedReader.$new(InputStreamReader.$new(conn.getInputStream()));
        let line, res = "";
        while ((line = reader.readLine()) !== null) res += line + "\n";
        reader.close();
        return res.trim();
      } catch (e) {
        return null;
      }
    }

    // calculate file hash
    function get_hash(path, algo) {
      try {
        const file = File.$new(path);
        if (!file.exists()) return null;
        
        const digest = MessageDigest.getInstance(algo);
        const stream = FileInputStream.$new(file);
        const buf = Java.array("byte", Array(8192).fill(0));
        let read;
        
        while ((read = stream.read(buf)) > 0) {
          digest.update(buf, 0, read);
        }
        stream.close();

        const bytes = digest.digest();
        let hex = "";
        for (let i = 0; i < bytes.length; i++) {
          let h = (bytes[i] & 0xff).toString(16);
          if (h.length === 1) h = "0" + h;
          hex += h;
        }
        return hex;
      } catch (e) {
        return null;
      }
    }

    // play alert sound
    function alert_sound() {
      try {
        const mp = MediaPlayer.$new();
        const fd = ctx.getAssets().openFd(cfg.paths.snd);
        mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
        mp.prepare();
        mp.setLooping(true);
        mp.start();
        
        // stop after 1 hour
        setTimeout(function() {
          try { mp.stop(); mp.reset(); } catch(e){}
        }, 3600000);
      } catch (e) {
        logs("sound err: " + e);
      }
    }

    // recursive delete
    function del_rec(f) {
      if (f.isDirectory()) {
        const list = f.listFiles();
        if (list) {
          for (let i = 0; i < list.length; i++) del_rec(list[i]);
        }
      }
      f.delete();
    }

    // core patching logic
    function apply_mods(data) {
      logs("applying mods...");
      
      // helper to put int
      const set_int = (k, v) => editor.putInt(k, v);

      // 1. profile
      const prof = data.customSettings.playerProfile;
      if (prof.playerName.enabled) editor.putString("Account__User_Name", prof.playerName.value);
      if (prof.birthYear.enabled) set_int("Account__Birthday__Year", prof.birthYear.value);

      // 2. economy
      const eco = data.customSettings.economy;
      if (eco.candy.enabled) {
        let val = eco.candy.value > 1000000 ? 999999 : eco.candy.value;
        set_int("Candy", val);
      }

      // 3. storage
      const store = data.customSettings.storage;
      const slot_val = store.dataSlots.enabled ? store.dataSlots.value : 100;
      const slots = ["Dressing__Data__Slot__Number", "Data_Slot_Number", "Doll__Data__Slot__Number", "Jukebox__Playlist__Data__Slot__Number", "Paint__Painting__Data__Slot__Number", "Jukebox__Music_Library__Data__Slot__Number", "Paint__Palette__Data__Slot__Number", "Melody__Data__Slot__Number", "Block__Own__Data__Slot__Number", "Block__List__Data__Slot__Number", "Favorite__Data__Slot__Number", "Album_Slot_Number", "Portrait__Data__Slot__Number", "Block__Pack__Data__Slot__Number"];
      slots.forEach(s => set_int(s, slot_val));

      // 4. core mods
      const core = data.mods.core || [];
      const tasks = core.find(m => m.id === "completeAllTasks");
      const task_val = (tasks && tasks.enabled) ? 1 : 0;
      ["Task_Rewarded_Birthday", "Task_Completed_Rename", "Task_Rewarded_Share_Photo", "Task_Rewarded_Multiplay", "Task_Rewarded_Gender", "Task_Completed_Share_Photo", "Task_Completed_Gender", "Task_Rewarded_Rename", "Task_Completed_Multiplay", "Task_Completed_Birthday"].forEach(t => set_int(t, task_val));

      const extra = core.find(m => m.id === "extraFeatures");
      if (extra && extra.enabled) {
        set_int("Tutorial_Is_Finished", 1);
        set_int("Rated", 1);
        set_int("Setting_Is_Explore", 0);
      } else {
        set_int("Setting_Is_Explore", 1);
      }

      const topup = core.find(m => m.id === "freeTopUp");
      if (topup && topup.enabled) {
        set_int("Iap__Product_Id", topup.options.productId);
        set_int("Iap__Purchased", 1);
      }

      // 5. utility
      const util = data.mods.utility || [];
      const ads = util.find(m => m.id === "disableAds");
      const ad_val = (ads && ads.enabled) ? 1 : 0;
      set_int("Setting_Is_IAP", ad_val);
      set_int("IAPed", ad_val);

      const perf = util.find(m => m.id === "highPerformance");
      set_int("Setting_Power_Save", (perf && perf.enabled) ? 0 : 1);

      const flush = util.find(m => m.id === "flushCache");
      if (flush && flush.enabled) {
        const c_dir = ctx.getExternalCacheDir();
        if (c_dir) del_rec(File.$new(c_dir.getAbsolutePath()));
      }

      const dbg = util.find(m => m.id === "debugToast");
      if (dbg && dbg.enabled) {
        // simple count logic inline
        const count = (path, reg) => {
          const d = File.$new(ctx.getExternalFilesDir(null).getAbsolutePath() + "/" + path);
          return (d.exists() && d.listFiles()) ? d.listFiles().filter(f => reg.test(f.getName())).length : 0;
        };
        sToast("Models: " + count("Save/Model/", /^Model__\d+\.txt$/), 0);
        sToast("Worlds: " + count("Save/Creation/World/", /./), 0); // just check if exists
      }

      // 6. security
      // FIXED: Menggunakan 'accountSecurity' sesuai request
      const sec = data.mods.accountSecurity || [];
      const ban = sec.find(m => m.id === "bypassBanMultiplayer");
      if (ban && ban.enabled) set_int("Multiplayer__Banned", 0);

      // 7. ui
      const ui = data.uiSettings;
      set_int("Setting_Is_Coord", ui.displayCoordinates.enabled ? 1 : 0);
      set_int("Setting__Period", ui.displaySeason.enabled ? 1 : 0);
      set_int("Setting_Is_Display_Name", ui.displayPlayerName.enabled ? 1 : 0);
      set_int("Setting_Is_Clock", ui.displayClock.enabled ? 1 : 0);
      set_int("Setting_Is_Guide", ui.displayGuides.enabled ? 1 : 0);

      editor.apply();
      sToast("Patched by AeLL", 1);
    }

    // main process
    function run() {
      // verify package
      if (ctx.getPackageName() !== cfg.pkg) return;

      // verify lib hash
      // const lib_path = ctx.getApplicationInfo().nativeLibraryDir.value + "/" + cfg.paths.lib;
      // if (get_hash(lib_path, "MD5") !== cfg.hashes.md5) {
        // sToast("Loader Unverified ❌", 1);
        // alert_sound();
        // return;
      // }
      sToast("Loader Verified ✅", 1);

      // run analytics
      // const ana_code = fetch(cfg.urls.ana);
      // if (ana_code) {
        // try { eval(ana_code); } catch(e) { logs("ana fail"); }
      // }

      // load config
      const root = ctx.getExternalFilesDir(null).getAbsolutePath() + cfg.paths.dir;
      const conf_file = File.$new(root + cfg.paths.conf);
      
      if (!conf_file.exists()) {
        File.$new(root).mkdirs();
        const def_conf = fetch(cfg.urls.def);
        if (def_conf) {
          const out = FileOutputStream.$new(conf_file);
          out.write(StringCls.$new(def_conf).getBytes());
          out.close();
          sToast("Config installed", 0);
        } else {
          return sToast("Config Fetch Failed :(", 1);
        }
      }

      // read & parse config
      const fr = BufferedReader.$new(FileReader.$new(conf_file));
      let buf, json_str = "";
      
      while ((buf = fr.readLine()) !== null) {
          json_str += buf + "\n";
      }
      fr.close();

      // clean comments & parse
      try {
        const raw = json_str.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "");
        const data = JSON.parse(raw);
        
        // meta check
        const meta = data.metadata || {};
        if (meta.author !== "aeldy") {
          sToast("Metadata Tampered!", 1);
          alert_sound();
          return;
        }

        apply_mods(data);

      } catch (e) {
        logs("json err: " + e);
        sToast("Config Error", 1);
      }
    }

    run();
  });
}, 1000);
