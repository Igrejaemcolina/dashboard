const page = document.querySelector('[data-page="installer"]');

if (page) {
  const elements = {
    stepsList: document.getElementById('installer-steps'),
    title: document.getElementById('installer-step-title'),
    description: document.getElementById('installer-step-description'),
    content: document.getElementById('installer-content'),
    back: document.getElementById('installer-back'),
    next: document.getElementById('installer-next'),
  };

  const state = {
    stepIndex: 0,
    project: {
      name: 'Dashboard IGColina',
      organization: 'Igreja Cristã em Colina',
      language: 'pt',
      sheetId: '',
      teenSheetId: '',
      timezone: 'America/Sao_Paulo',
      contactEmail: '',
    },
    services: [],
    roles: [],
    editingServiceId: null,
    editingRoleId: null,
    feedback: new Map(),
  };

  const steps = [
    {
      id: 'welcome',
      title: 'Bem-vindo',
      description:
        'Vamos guiá-lo pela configuração da dashboard, do acesso às planilhas até os perfis autorizados.',
      render: renderWelcome,
      validate: () => true,
    },
    {
      id: 'project',
      title: 'Configurar origem dos dados',
      description:
        'Informe os identificadores das planilhas e os dados gerais da congregação.',
      render: renderProject,
      validate: validateProject,
    },
    {
      id: 'services',
      title: 'Cadastrar frentes de serviço',
      description:
        'Liste os ministérios disponíveis. Você poderá adicionar mais tarde diretamente no painel.',
      render: renderServices,
      validate: validateServices,
    },
    {
      id: 'roles',
      title: 'Definir perfis e permissões',
      description:
        'Crie os perfis, gere as senhas criptografadas e defina quem pode administrar o painel.',
      render: renderRoles,
      validate: validateRoles,
    },
    {
      id: 'summary',
      title: 'Gerar pacote de instalação',
      description:
        'Revise o resumo, copie ou exporte o arquivo de configuração para finalizar a instalação.',
      render: renderSummary,
      validate: () => true,
    },
  ];

  elements.back.addEventListener('click', () => {
    if (state.stepIndex === 0) {
      return;
    }
    state.stepIndex -= 1;
    renderStep();
  });

  elements.next.addEventListener('click', async () => {
    const currentStep = steps[state.stepIndex];
    if (currentStep && typeof currentStep.validate === 'function') {
      const valid = await currentStep.validate();
      if (!valid) {
        showStepFeedback(
          currentStep.id,
          'Revise as informações antes de continuar.',
          'error'
        );
        return;
      }
    }

    if (state.stepIndex < steps.length - 1) {
      state.stepIndex += 1;
      renderStep();
      return;
    }

    showStepFeedback(
      'summary',
      'Configuração finalizada! Baixe ou copie o pacote gerado.',
      'success'
    );
  });

  renderStep();

  function renderStep() {
    const step = steps[state.stepIndex];
    if (!step) {
      return;
    }

    updateStepList();

    if (elements.title) {
      elements.title.textContent = step.title;
    }
    if (elements.description) {
      elements.description.textContent = step.description;
    }
    if (typeof step.render === 'function') {
      step.render(elements.content);
    }

    applyStoredFeedback(step.id);
    updateNavigation();
  }

  function updateNavigation() {
    const isFirst = state.stepIndex === 0;
    const isLast = state.stepIndex === steps.length - 1;
    if (elements.back) {
      elements.back.disabled = isFirst;
    }
    if (elements.next) {
      elements.next.textContent = isLast ? 'Concluir' : 'Próximo';
    }
  }

  function updateStepList() {
    if (!elements.stepsList) {
      return;
    }

    elements.stepsList.innerHTML = '';

    steps.forEach((step, index) => {
      const item = document.createElement('li');
      item.className = 'installer-step-item';
      if (index === state.stepIndex) {
        item.classList.add('active');
      } else if (index < state.stepIndex) {
        item.classList.add('completed');
      }

      const indicator = document.createElement('span');
      indicator.className = 'installer-step-index';
      indicator.textContent = index + 1;
      item.appendChild(indicator);

      const body = document.createElement('div');
      body.className = 'installer-step-body';

      const title = document.createElement('span');
      title.className = 'installer-step-title';
      title.textContent = step.title;
      body.appendChild(title);

      const description = document.createElement('p');
      description.className = 'installer-step-description';
      description.textContent = step.description;
      body.appendChild(description);

      item.appendChild(body);
      elements.stepsList.appendChild(item);
    });
  }

  function renderWelcome(container) {
    if (!container) {
      return;
    }

    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'installer-intro';

    const lead = document.createElement('p');
    lead.innerHTML =
      'Este instalador cria a estrutura inicial da dashboard em poucos passos, organizando as planilhas, perfis e serviços.';
    wrapper.appendChild(lead);

    const list = document.createElement('ul');
    list.innerHTML = `
      <li>Conecte a planilha principal e a lista auxiliar de adolescentes.</li>
      <li>Cadastre os serviços da vida da igreja em três idiomas.</li>
      <li>Defina os perfis autorizados e gere as senhas já criptografadas.</li>
      <li>Exporte um pacote JSON pronto para ser incorporado ao código.</li>
    `;
    wrapper.appendChild(list);

    const tip = document.createElement('div');
    tip.className = 'installer-status';
    tip.textContent =
      'Comece quando quiser. Você pode navegar entre as etapas sem perder as informações preenchidas.';
    wrapper.appendChild(tip);

    container.appendChild(wrapper);
  }

  function renderProject(container) {
    if (!container) {
      return;
    }

    container.innerHTML = '';

    const form = document.createElement('form');
    form.className = 'installer-grid two-columns';
    form.id = 'installer-project-form';

    form.innerHTML = `
      <div class="field-group">
        <label for="installer-project-name">Nome do projeto</label>
        <input
          type="text"
          id="installer-project-name"
          placeholder="Ex.: Dashboard IGColina"
          maxlength="80"
          autocomplete="organization"
        />
      </div>
      <div class="field-group">
        <label for="installer-project-organization">Congregação</label>
        <input
          type="text"
          id="installer-project-organization"
          placeholder="Ex.: Igreja Cristã em Colina"
          maxlength="120"
          autocomplete="organization-title"
        />
      </div>
      <div class="field-group">
        <label for="installer-project-language">Idioma padrão</label>
        <select id="installer-project-language">
          <option value="pt">Português</option>
          <option value="en">Inglês</option>
          <option value="es">Espanhol</option>
        </select>
      </div>
      <div class="field-group">
        <label for="installer-project-timezone">Fuso horário</label>
        <input
          type="text"
          id="installer-project-timezone"
          placeholder="Ex.: America/Sao_Paulo"
          maxlength="60"
          autocomplete="off"
        />
      </div>
      <div class="field-group">
        <label for="installer-project-sheet">ID da planilha principal</label>
        <input
          type="text"
          id="installer-project-sheet"
          placeholder="Cole o ID da planilha com os cadastros"
          autocomplete="off"
        />
      </div>
      <div class="field-group">
        <label for="installer-project-teens">ID da planilha auxiliar (adolescentes)</label>
        <input
          type="text"
          id="installer-project-teens"
          placeholder="Cole o ID da planilha complementar"
          autocomplete="off"
        />
      </div>
      <div class="field-group">
        <label for="installer-project-email">Contato responsável (opcional)</label>
        <input
          type="email"
          id="installer-project-email"
          placeholder="seuemail@igreja.com"
          autocomplete="email"
        />
      </div>
    `;

    const status = document.createElement('div');
    status.className = 'installer-status';
    status.dataset.installerStatus = 'project';
    status.hidden = true;

    container.append(form, status);

    const nameInput = form.querySelector('#installer-project-name');
    const orgInput = form.querySelector('#installer-project-organization');
    const languageSelect = form.querySelector('#installer-project-language');
    const timezoneInput = form.querySelector('#installer-project-timezone');
    const sheetInput = form.querySelector('#installer-project-sheet');
    const teenInput = form.querySelector('#installer-project-teens');
    const emailInput = form.querySelector('#installer-project-email');

    if (nameInput) nameInput.value = state.project.name ?? '';
    if (orgInput) orgInput.value = state.project.organization ?? '';
    if (languageSelect) languageSelect.value = state.project.language ?? 'pt';
    if (timezoneInput) timezoneInput.value = state.project.timezone ?? '';
    if (sheetInput) sheetInput.value = state.project.sheetId ?? '';
    if (teenInput) teenInput.value = state.project.teenSheetId ?? '';
    if (emailInput) emailInput.value = state.project.contactEmail ?? '';

    form.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }
      switch (target.id) {
        case 'installer-project-name':
          state.project.name = target.value;
          break;
        case 'installer-project-organization':
          state.project.organization = target.value;
          break;
        case 'installer-project-language':
          state.project.language = target.value;
          break;
        case 'installer-project-timezone':
          state.project.timezone = target.value;
          break;
        case 'installer-project-sheet':
          state.project.sheetId = target.value;
          break;
        case 'installer-project-teens':
          state.project.teenSheetId = target.value;
          break;
        case 'installer-project-email':
          state.project.contactEmail = target.value;
          break;
        default:
          break;
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
    });

    applyStoredFeedback('project');
  }

  function validateProject() {
    const name = (state.project.name ?? '').trim();
    const sheetId = (state.project.sheetId ?? '').trim();
    if (!name || !sheetId) {
      showStepFeedback(
        'project',
        'Preencha pelo menos o nome do projeto e o ID da planilha principal.',
        'error'
      );
      return false;
    }
    return true;
  }

  function renderServices(container) {
    if (!container) {
      return;
    }

    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'installer-grid';

    const form = document.createElement('form');
    form.className = 'installer-grid two-columns';
    form.id = 'installer-service-form';
    form.innerHTML = `
      <div class="field-group">
        <label for="installer-service-name">Nome em Português</label>
        <input
          type="text"
          id="installer-service-name"
          placeholder="Ex.: Recepção"
          autocomplete="off"
          maxlength="80"
        />
      </div>
      <div class="field-group">
        <label for="installer-service-name-en">Nome em Inglês</label>
        <input
          type="text"
          id="installer-service-name-en"
          placeholder="Ex.: Welcome team"
          autocomplete="off"
          maxlength="80"
        />
      </div>
      <div class="field-group">
        <label for="installer-service-name-es">Nome em Espanhol</label>
        <input
          type="text"
          id="installer-service-name-es"
          placeholder="Ex.: Recepción"
          autocomplete="off"
          maxlength="80"
        />
      </div>
      <div class="field-group">
        <label for="installer-service-notes">Observações (opcional)</label>
        <textarea
          id="installer-service-notes"
          placeholder="Use para descrever requisitos ou observações sobre o serviço."
        ></textarea>
      </div>
      <div class="installer-summary-actions">
        <button type="submit" id="installer-service-submit">Adicionar serviço</button>
        <button type="button" class="ghost" id="installer-service-cancel" hidden>Cancelar</button>
      </div>
    `;

    const listWrapper = document.createElement('div');
    listWrapper.className = 'installer-grid';

    const listTitle = document.createElement('h2');
    listTitle.textContent = 'Serviços cadastrados';
    listWrapper.appendChild(listTitle);

    const list = document.createElement('ul');
    list.id = 'installer-service-list';
    list.className = 'installer-card-list';
    listWrapper.appendChild(list);

    const empty = document.createElement('div');
    empty.id = 'installer-service-empty';
    empty.className = 'installer-empty-state';
    empty.textContent = 'Nenhum serviço cadastrado até o momento.';
    listWrapper.appendChild(empty);

    const status = document.createElement('div');
    status.className = 'installer-status';
    status.dataset.installerStatus = 'services';
    status.hidden = true;

    grid.append(form, status, listWrapper);
    container.appendChild(grid);

    const nameInput = form.querySelector('#installer-service-name');
    const nameEnInput = form.querySelector('#installer-service-name-en');
    const nameEsInput = form.querySelector('#installer-service-name-es');
    const notesInput = form.querySelector('#installer-service-notes');
    const submitButton = form.querySelector('#installer-service-submit');
    const cancelButton = form.querySelector('#installer-service-cancel');

    if (state.editingServiceId) {
      const service = state.services.find((item) => item.id === state.editingServiceId);
      if (service) {
        if (nameInput) nameInput.value = service.labels.pt;
        if (nameEnInput) nameEnInput.value = service.labels.en;
        if (nameEsInput) nameEsInput.value = service.labels.es;
        if (notesInput) notesInput.value = service.notes ?? '';
        if (submitButton) submitButton.textContent = 'Salvar alterações';
        if (cancelButton) cancelButton.hidden = false;
      }
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const pt = (nameInput?.value ?? '').trim();
      const en = (nameEnInput?.value ?? '').trim();
      const es = (nameEsInput?.value ?? '').trim();
      const notes = (notesInput?.value ?? '').trim();

      if (!pt) {
        showStepFeedback('services', 'Informe pelo menos o nome em Português.', 'error');
        nameInput?.focus();
        return;
      }

      const id = normalizeServiceId(pt);
      if (!id) {
        showStepFeedback('services', 'Não foi possível gerar um identificador para o serviço.', 'error');
        return;
      }

      const labels = {
        pt,
        en: en || pt,
        es: es || pt,
      };

      if (state.editingServiceId) {
        const duplicated = state.services.find(
          (item) => item.id !== state.editingServiceId && item.id === id
        );
        if (duplicated) {
          showStepFeedback(
            'services',
            'Já existe outro serviço com este nome. Escolha uma variação diferente.',
            'error'
          );
          return;
        }
        const service = state.services.find((item) => item.id === state.editingServiceId);
        if (service) {
          service.id = id;
          service.labels = labels;
          service.notes = notes;
          service.updatedAt = new Date().toISOString();
        }
        state.editingServiceId = null;
        showStepFeedback('services', 'Serviço atualizado com sucesso.', 'success');
      } else {
        const exists = state.services.some((item) => item.id === id);
        if (exists) {
          showStepFeedback(
            'services',
            'Este serviço já foi cadastrado. Faça um ajuste no nome para diferenciá-lo.',
            'error'
          );
          return;
        }
        state.services.push({
          id,
          labels,
          notes,
          createdAt: new Date().toISOString(),
        });
        showStepFeedback('services', 'Serviço adicionado à lista.', 'success');
      }

      if (nameInput) nameInput.value = '';
      if (nameEnInput) nameEnInput.value = '';
      if (nameEsInput) nameEsInput.value = '';
      if (notesInput) notesInput.value = '';
      if (submitButton) submitButton.textContent = 'Adicionar serviço';
      if (cancelButton) cancelButton.hidden = true;
      renderServiceList(list, empty);
    });

    cancelButton?.addEventListener('click', () => {
      state.editingServiceId = null;
      if (nameInput) nameInput.value = '';
      if (nameEnInput) nameEnInput.value = '';
      if (nameEsInput) nameEsInput.value = '';
      if (notesInput) notesInput.value = '';
      if (submitButton) submitButton.textContent = 'Adicionar serviço';
      cancelButton.hidden = true;
      renderServiceList(list, empty);
    });

    list.addEventListener('click', (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest('button') : null;
      if (!button) {
        return;
      }
      const action = button.dataset.action;
      const item = button.closest('[data-service-id]');
      if (!item) {
        return;
      }
      const serviceId = item.getAttribute('data-service-id');
      if (!serviceId) {
        return;
      }

      if (action === 'edit') {
        state.editingServiceId = serviceId;
        renderServices(container);
        const focusTarget = container.querySelector('#installer-service-name');
        focusTarget?.focus();
        return;
      }

      if (action === 'remove') {
        const confirmed = window.confirm('Remover este serviço da lista?');
        if (!confirmed) {
          return;
        }
        state.services = state.services.filter((item) => item.id !== serviceId);
        if (state.editingServiceId === serviceId) {
          state.editingServiceId = null;
        }
        renderServiceList(list, empty);
        showStepFeedback('services', 'Serviço removido.', 'success');
      }
    });

    renderServiceList(list, empty);

    applyStoredFeedback('services');
  }

  function renderServiceList(list, emptyState) {
    if (!list || !emptyState) {
      return;
    }

    list.innerHTML = '';
    if (!state.services.length) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    const template = document.getElementById('service-row-template');
    state.services
      .slice()
      .sort((a, b) => a.labels.pt.localeCompare(b.labels.pt, 'pt-BR'))
      .forEach((service) => {
        if (!(template instanceof HTMLTemplateElement)) {
          return;
        }
        const fragment = template.content.cloneNode(true);
        const item = fragment.querySelector('li');
        if (!item) {
          return;
        }
        item.setAttribute('data-service-id', service.id);
        const title = item.querySelector('.installer-card-title');
        if (title) {
          title.textContent = service.labels.pt;
        }
        const meta = item.querySelector('.installer-card-meta');
        if (meta) {
          const translations = [`EN: ${service.labels.en}`, `ES: ${service.labels.es}`];
          if (service.notes) {
            translations.push(service.notes);
          }
          meta.textContent = translations.join(' · ');
        }
        list.appendChild(fragment);
      });
  }

  function validateServices() {
    if (!state.services.length) {
      showStepFeedback(
        'services',
        'Cadastre pelo menos um serviço para continuar. Você pode adicionar os demais depois.',
        'error'
      );
      return false;
    }
    return true;
  }

  function renderRoles(container) {
    if (!container) {
      return;
    }

    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'installer-grid';

    const form = document.createElement('form');
    form.className = 'installer-grid';
    form.id = 'installer-role-form';
    form.innerHTML = `
      <div class="installer-grid two-columns">
        <div class="field-group">
          <label for="installer-role-username">Usuário</label>
          <input
            type="text"
            id="installer-role-username"
            placeholder="Ex.: jpfachina"
            autocomplete="username"
            maxlength="60"
          />
        </div>
        <div class="field-group">
          <label for="installer-role-display">Nome completo</label>
          <input
            type="text"
            id="installer-role-display"
            placeholder="Nome exibido na dashboard"
            maxlength="120"
            autocomplete="name"
          />
        </div>
      </div>
      <div class="field-group">
        <label for="installer-role-description">Descrição</label>
        <textarea
          id="installer-role-description"
          placeholder="Descreva o papel deste perfil na congregação."
        ></textarea>
      </div>
      <div class="installer-grid two-columns">
        <div class="field-group">
          <label for="installer-role-password">Senha</label>
          <input
            type="password"
            id="installer-role-password"
            placeholder="Defina a senha do perfil"
            autocomplete="new-password"
          />
        </div>
        <div class="field-group">
          <label for="installer-role-confirm">Confirmar senha</label>
          <input
            type="password"
            id="installer-role-confirm"
            placeholder="Repita a senha"
            autocomplete="new-password"
          />
        </div>
      </div>
      <div class="installer-grid two-columns">
        <label class="toggle-group">
          <input type="checkbox" id="installer-role-manage-services" />
          <span>Pode gerenciar serviços</span>
        </label>
        <label class="toggle-group">
          <input type="checkbox" id="installer-role-manage-profiles" />
          <span>Pode cadastrar novos perfis</span>
        </label>
        <label class="toggle-group">
          <input type="checkbox" id="installer-role-change-password" />
          <span>Pode trocar a própria senha</span>
        </label>
      </div>
      <div class="installer-summary-actions">
        <button type="submit" id="installer-role-submit">Adicionar perfil</button>
        <button type="button" class="ghost" id="installer-role-cancel" hidden>Cancelar</button>
      </div>
    `;

    const status = document.createElement('div');
    status.className = 'installer-status';
    status.dataset.installerStatus = 'roles';
    status.hidden = true;

    const listWrapper = document.createElement('div');
    listWrapper.className = 'installer-grid';

    const title = document.createElement('h2');
    title.textContent = 'Perfis configurados';
    listWrapper.appendChild(title);

    const list = document.createElement('ul');
    list.id = 'installer-role-list';
    list.className = 'installer-card-list';
    listWrapper.appendChild(list);

    const empty = document.createElement('div');
    empty.id = 'installer-role-empty';
    empty.className = 'installer-empty-state';
    empty.textContent = 'Nenhum perfil cadastrado ainda.';
    listWrapper.appendChild(empty);

    grid.append(form, status, listWrapper);
    container.appendChild(grid);

    const usernameInput = form.querySelector('#installer-role-username');
    const displayInput = form.querySelector('#installer-role-display');
    const descriptionInput = form.querySelector('#installer-role-description');
    const passwordInput = form.querySelector('#installer-role-password');
    const confirmInput = form.querySelector('#installer-role-confirm');
    const manageServicesInput = form.querySelector('#installer-role-manage-services');
    const manageProfilesInput = form.querySelector('#installer-role-manage-profiles');
    const changePasswordInput = form.querySelector('#installer-role-change-password');
    const submitButton = form.querySelector('#installer-role-submit');
    const cancelButton = form.querySelector('#installer-role-cancel');

    if (state.editingRoleId) {
      const role = state.roles.find((item) => item.id === state.editingRoleId);
      if (role) {
        if (usernameInput) usernameInput.value = role.id;
        if (displayInput) displayInput.value = role.displayName ?? '';
        if (descriptionInput) descriptionInput.value = role.description ?? '';
        if (passwordInput) passwordInput.value = '';
        if (confirmInput) confirmInput.value = '';
        if (manageServicesInput) manageServicesInput.checked = Boolean(role.permissions?.manageServices);
        if (manageProfilesInput) manageProfilesInput.checked = Boolean(role.permissions?.manageProfiles);
        if (changePasswordInput)
          changePasswordInput.checked = role.permissions?.changePassword !== false;
        if (submitButton) submitButton.textContent = 'Salvar alterações';
        if (cancelButton) cancelButton.hidden = false;
      }
    } else if (changePasswordInput) {
      changePasswordInput.checked = true;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = (usernameInput?.value ?? '').trim();
      const normalizedUsername = normalizeIdentifier(username);
      const displayName = (displayInput?.value ?? '').trim();
      const description = (descriptionInput?.value ?? '').trim();
      const password = passwordInput?.value ?? '';
      const confirm = confirmInput?.value ?? '';
      const manageServices = Boolean(manageServicesInput?.checked);
      const manageProfiles = Boolean(manageProfilesInput?.checked);
      const changePassword = Boolean(changePasswordInput?.checked);

      if (!normalizedUsername) {
        showStepFeedback('roles', 'Informe um identificador para o perfil.', 'error');
        usernameInput?.focus();
        return;
      }

      if (!displayName) {
        showStepFeedback('roles', 'Informe o nome exibido para o perfil.', 'error');
        displayInput?.focus();
        return;
      }

      if (state.editingRoleId) {
        const duplicated = state.roles.find(
          (role) => role.id !== state.editingRoleId && role.id === normalizedUsername
        );
        if (duplicated) {
          showStepFeedback('roles', 'Já existe outro perfil com este usuário.', 'error');
          return;
        }
      } else {
        const exists = state.roles.some((role) => role.id === normalizedUsername);
        if (exists) {
          showStepFeedback('roles', 'Este usuário já está cadastrado.', 'error');
          return;
        }
      }

      if (manageProfiles && normalizedUsername !== 'jpfachina') {
        showStepFeedback(
          'roles',
          'Apenas o perfil jpfachina pode receber permissão para cadastrar novos perfis.',
          'error'
        );
        manageProfilesInput?.focus();
        return;
      }

      if (password || confirm || !state.editingRoleId) {
        if (!password || password.length < 6) {
          showStepFeedback(
            'roles',
            'Defina uma senha com pelo menos 6 caracteres.',
            'error'
          );
          passwordInput?.focus();
          return;
        }
        if (password !== confirm) {
          showStepFeedback('roles', 'As senhas não conferem.', 'error');
          confirmInput?.focus();
          return;
        }
      }

      const permissions = {
        manageServices,
        manageProfiles,
        changePassword,
      };

      let passwordHash = null;
      if (password) {
        try {
          passwordHash = await hashString(password);
        } catch (error) {
          console.error('Erro ao gerar hash de senha', error);
          showStepFeedback(
            'roles',
            'Não foi possível criptografar a senha. Tente novamente.',
            'error'
          );
          return;
        }
      }

      if (state.editingRoleId) {
        const role = state.roles.find((item) => item.id === state.editingRoleId);
        if (role) {
          role.id = normalizedUsername;
          role.displayName = displayName;
          role.description = description;
          role.permissions = permissions;
          role.updatedAt = new Date().toISOString();
          if (passwordHash) {
            role.passwordHash = passwordHash;
          }
        }
        state.editingRoleId = null;
        showStepFeedback('roles', 'Perfil atualizado com sucesso.', 'success');
      } else {
        const hash = passwordHash ?? (await hashString(password));
        state.roles.push({
          id: normalizedUsername,
          displayName,
          description,
          permissions,
          passwordHash: hash,
          createdAt: new Date().toISOString(),
        });
        showStepFeedback('roles', 'Perfil adicionado à lista.', 'success');
      }

      if (usernameInput) usernameInput.value = '';
      if (displayInput) displayInput.value = '';
      if (descriptionInput) descriptionInput.value = '';
      if (passwordInput) passwordInput.value = '';
      if (confirmInput) confirmInput.value = '';
      if (manageServicesInput) manageServicesInput.checked = false;
      if (manageProfilesInput) manageProfilesInput.checked = false;
      if (changePasswordInput) changePasswordInput.checked = true;
      if (submitButton) submitButton.textContent = 'Adicionar perfil';
      if (cancelButton) cancelButton.hidden = true;

      renderRoleList(list, empty);
    });

    cancelButton?.addEventListener('click', () => {
      state.editingRoleId = null;
      renderRoles(container);
    });

    list.addEventListener('click', (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest('button') : null;
      if (!button) {
        return;
      }
      const action = button.dataset.action;
      const item = button.closest('[data-role-id]');
      if (!item) {
        return;
      }
      const roleId = item.getAttribute('data-role-id');
      if (!roleId) {
        return;
      }
      if (action === 'edit') {
        state.editingRoleId = roleId;
        renderRoles(container);
        const focusTarget = container.querySelector('#installer-role-display');
        focusTarget?.focus();
        return;
      }
      if (action === 'remove') {
        if (roleId === 'jpfachina') {
          showStepFeedback('roles', 'O perfil jpfachina não pode ser removido.', 'error');
          return;
        }
        const confirmed = window.confirm('Deseja remover este perfil?');
        if (!confirmed) {
          return;
        }
        state.roles = state.roles.filter((role) => role.id !== roleId);
        if (state.editingRoleId === roleId) {
          state.editingRoleId = null;
        }
        renderRoleList(list, empty);
        showStepFeedback('roles', 'Perfil removido.', 'success');
      }
    });

    renderRoleList(list, empty);

    applyStoredFeedback('roles');
  }

  function renderRoleList(list, emptyState) {
    if (!list || !emptyState) {
      return;
    }

    list.innerHTML = '';
    if (!state.roles.length) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    const template = document.getElementById('role-row-template');
    state.roles
      .slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'))
      .forEach((role) => {
        if (!(template instanceof HTMLTemplateElement)) {
          return;
        }
        const fragment = template.content.cloneNode(true);
        const item = fragment.querySelector('li');
        if (!item) {
          return;
        }
        item.setAttribute('data-role-id', role.id);
        const title = item.querySelector('.installer-card-title');
        if (title) {
          title.textContent = role.displayName || role.id;
        }
        const meta = item.querySelector('.installer-card-meta');
        if (meta) {
          const permissions = [];
          if (role.permissions?.manageServices) {
            permissions.push('Gerencia serviços');
          }
          if (role.permissions?.manageProfiles) {
            permissions.push('Administra perfis');
          }
          if (role.permissions?.changePassword !== false) {
            permissions.push('Pode trocar a própria senha');
          }
          meta.textContent = `${role.id} · ${permissions.join(' · ')}`;
        }
        list.appendChild(fragment);
      });
  }

  function validateRoles() {
    if (!state.roles.length) {
      showStepFeedback(
        'roles',
        'Cadastre pelo menos um perfil para continuar.',
        'error'
      );
      return false;
    }
    const hasAdmin = state.roles.some((role) => role.id === 'jpfachina');
    if (!hasAdmin) {
      showStepFeedback(
        'roles',
        'Inclua o perfil jpfachina para administrar os demais usuários.',
        'error'
      );
      return false;
    }
    return true;
  }

  function renderSummary(container) {
    if (!container) {
      return;
    }

    container.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = 'installer-summary';

    const status = document.createElement('div');
    status.className = 'installer-status';
    status.dataset.installerStatus = 'summary';
    status.hidden = true;

    const pre = document.createElement('pre');
    pre.id = 'installer-summary-json';
    pre.textContent = JSON.stringify(buildConfiguration(), null, 2);

    const actions = document.createElement('div');
    actions.className = 'installer-summary-actions';

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.textContent = 'Copiar JSON';
    copyButton.addEventListener('click', async () => {
      try {
        await copyToClipboard(pre.textContent || '');
        showStepFeedback('summary', 'Configuração copiada para a área de transferência.', 'success');
      } catch (error) {
        console.error('Erro ao copiar JSON', error);
        showStepFeedback(
          'summary',
          'Não foi possível copiar automaticamente. Selecione o texto manualmente.',
          'error'
        );
      }
    });

    const downloadButton = document.createElement('button');
    downloadButton.type = 'button';
    downloadButton.textContent = 'Baixar arquivo';
    downloadButton.addEventListener('click', () => {
      try {
        const blob = new Blob([pre.textContent || ''], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `dashboard-config-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showStepFeedback('summary', 'Download iniciado com sucesso.', 'success');
      } catch (error) {
        console.error('Erro ao baixar JSON', error);
        showStepFeedback('summary', 'Não foi possível gerar o arquivo.', 'error');
      }
    });

    actions.append(copyButton, downloadButton);

    summary.append(status, pre, actions);
    container.appendChild(summary);

    applyStoredFeedback('summary');
  }

  function buildConfiguration() {
    const timestamp = new Date().toISOString();
    return {
      project: {
        name: state.project.name?.trim() || 'Dashboard IGColina',
        organization: state.project.organization?.trim() || '',
        language: state.project.language || 'pt',
        sheetId: state.project.sheetId?.trim() || '',
        teenSheetId: state.project.teenSheetId?.trim() || '',
        timezone: state.project.timezone?.trim() || '',
        contactEmail: state.project.contactEmail?.trim() || '',
      },
      services: state.services.map((service) => ({
        id: service.id,
        labels: service.labels,
        notes: service.notes ?? '',
      })),
      roles: state.roles.map((role) => ({
        id: role.id,
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
        passwordHash: role.passwordHash,
      })),
      generatedAt: timestamp,
    };
  }

  function showStepFeedback(stepId, message, type = 'info') {
    if (!stepId) {
      return;
    }
    if (message) {
      state.feedback.set(stepId, { message, type });
    } else {
      state.feedback.delete(stepId);
    }

    if (!elements.content) {
      return;
    }

    const status = elements.content.querySelector(`.installer-status[data-installer-status="${stepId}"]`);
    if (!status) {
      return;
    }

    if (!message) {
      status.hidden = true;
      status.textContent = '';
      status.classList.remove('error', 'success');
      return;
    }

    status.hidden = false;
    status.textContent = message;
    status.classList.toggle('error', type === 'error');
    status.classList.toggle('success', type === 'success');
  }

  function applyStoredFeedback(stepId) {
    if (!stepId || !elements.content) {
      return;
    }
    const feedback = state.feedback.get(stepId);
    if (!feedback) {
      return;
    }
    const status = elements.content.querySelector(`.installer-status[data-installer-status="${stepId}"]`);
    if (!status) {
      return;
    }
    status.hidden = false;
    status.textContent = feedback.message;
    status.classList.toggle('error', feedback.type === 'error');
    status.classList.toggle('success', feedback.type === 'success');
  }

  function normalizeServiceId(value) {
    if (!value) {
      return '';
    }
    const base = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let sanitized = '';
    try {
      sanitized = base.replace(/[^\p{Letter}\p{Number}]+/gu, '-');
    } catch (error) {
      sanitized = base.replace(/[^a-zA-Z0-9]+/g, '-');
    }
    return sanitized.replace(/^-+|-+$/g, '').toLowerCase();
  }

  function normalizeIdentifier(value) {
    if (!value) {
      return '';
    }
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]+/g, '');
  }

  async function hashString(value) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Criptografia indisponível neste navegador.');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  async function copyToClipboard(text) {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API indisponível');
    }
    await navigator.clipboard.writeText(text);
  }
}
