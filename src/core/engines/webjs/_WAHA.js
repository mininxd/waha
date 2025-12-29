exports.LoadWAHA = () => {
  window.WAHA = {};
  window.WAHA.WAWebBizLabelEditingAction = window.require(
    'WAWebBizLabelEditingAction',
  );

  window.WAHA.getChats = async (pagination, filter) => {
    let chats = window.Store.Chat.getModelsArray().slice();

    // Filter chats by IDs if filter is provided
    if (filter && filter.ids && filter.ids.length > 0) {
      chats = chats.filter((chat) => filter.ids.includes(chat.id._serialized));
    }

    const paginator = new window.Paginator(pagination);
    chats = paginator.apply(chats);
    const chatPromises = chats.map((chat) => window.WWebJS.getChatModel(chat));
    return await Promise.all(chatPromises);
  };

  // Wrapper for window.WWebJS.getChat to ensure chatId is present
  const originalGetChat = window.WWebJS.getChat;
  window.WWebJS.getChat = async (chatId, options) => {
    if (!chatId) {
      throw new Error(
        'chatId is required in window.WWebJS.getChat. Please check if you are passing a valid chat ID.',
      );
    }
    return originalGetChat(chatId, options);
  };

  // Set push name
  window.WAHA.WAWebSetPushnameConnAction = window.require(
    'WAWebSetPushnameConnAction',
  );

  // Get my status
  window.WAHA.WAWebTextStatusCollection = window.require(
    'WAWebTextStatusCollection',
  );
};
