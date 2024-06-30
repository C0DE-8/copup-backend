const PushNotifications = require("node-pushnotifications");

const settings = {
  gcm: {
    id: null,
  },
  apn: {
    token: {
      key: "./path/to/APNsAuthKey_XXXXXXXXXX.p8", // optional
      keyId: "key-id", // optional
      teamId: "developer-team-id", // optional
    },
    production: false, // optional
  },
  adm: {
    client_id: null,
    client_secret: null,
  },
  wns: {
    client_id: null,
    client_secret: null,
    notificationMethod: "sendTileSquareBlock",
  },
  web: {
    vapidDetails: {
      subject: "mailto:example@yourdomain.org",
      publicKey:
        "BD0pGy0MbookWOv2_cnlBTKxycyPv0WDU0WJ97dsLMm-nCo1qz2Sa6CZO5d6iPeEgVKYTF0NaXkSQ7iUSu8HgxM",
      privateKey: "ITaMbSmrN7FxBzO_SH4nIKZj-sdWf91kikdISohiD7E",
    },
    gcmAPIKey:
      "BO2BjDNSC3aCgWSvv7N_Lhfals8y_sK_tFtmOrtd5JZO3Qg-I_IVa-ij_KakyVDPuLgfjlizLQT7BhfWEe3X3xA",
  },
  isAlwaysUseFCM: false, // optional
};

const push = new PushNotifications(settings);

module.exports = push;
