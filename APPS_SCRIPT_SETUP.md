# Google Apps Script Setup

1. Abra a planilha no Google Sheets e vá em **Extensões → Apps Script**.
2. Apague qualquer código existente no editor e cole o conteúdo de `appsScript.gs`.
3. Clique em **Salvar** e depois execute manualmente a função `syncAll()` pela primeira vez:
   1. No editor, abra o seletor de funções e escolha `syncAll`.
   2. Clique no botão ▶️ para executar.
   3. Conceda as permissões solicitadas pelo Google (use a conta que é proprietária da planilha).
4. Volte para a planilha, recarregue a página. Você verá o menu **⚙️ Sincronização** na barra superior.
5. Use **Sincronizar agora** para atualizar todas as abas de serviços e **Mostrar popup da pessoa (linha atual)** para abrir o modal com os dados da pessoa selecionada na aba `serviços`.

Depois da primeira autorização, as próximas execuções funcionarão diretamente pelo menu.
