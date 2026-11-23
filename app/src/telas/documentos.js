// Política de privacidade e termos de uso do Hub (#/privacidade e #/termos).
// Abrem com ou sem login: quem ainda vai pedir acesso precisa poder ler antes.
//
// O texto descreve o que o banco guarda DE VERDADE (tabelas em
// supabase/migrations). Se um módulo novo passar a guardar dado pessoal,
// acrescente aqui na mesma mudança, e troque ATUALIZADO_EM.
import { h, icone } from '../util/dom.js';
import { cabecalhoApp } from './moldura.js';

const ATUALIZADO_EM = '16 de novembro de 2026';
const EMAIL = 'contatoiejb@gmail.com';

const s = (titulo, ...conteudo) => h('section', { class: 'doc-secao' }, h('h2', null, titulo), ...conteudo);
const p = (...t) => h('p', null, ...t);
const lista = (...itens) => h('ul', null, itens.map((i) => h('li', null, ...[].concat(i))));
const b = (t) => h('strong', null, t);
const email = () => h('a', { href: `mailto:${EMAIL}` }, EMAIL);

function privacidade() {
    return [
        p('O IEJB Hub é o aplicativo interno da IEJB - Igreja Evangélica do Jardim Brasil (Araçariguama - SP) para organizar escalas, repertórios, eventos, o mural de avisos e o caixa da igreja. Esta página explica quais dados ele guarda, por que, quem vê e o que você pode pedir.'),
        s('Quem cuida dos dados',
            p('A IEJB é a responsável pelos dados (controladora, na linguagem da LGPD). Para qualquer pedido sobre os seus dados, fale com a liderança ou escreva para ', email(), '.')),
        s('O que o Hub guarda',
            lista(
                [b('Conta: '), 'e-mail de login, o nome que você informou ao pedir acesso, a situação da conta e quem a aprovou. A senha fica com o serviço de login e nunca é vista por ninguém da igreja.'],
                [b('Cadastro: '), 'nome, apelido, telefone de contato (se você ou a liderança informar), instrumentos que toca e foto de perfil (se você enviar).'],
                [b('Participação: '), 'grupos de que faz parte, escalas em que está, quando marca que não vai e funções na igreja (por exemplo Tesouraria ou Comunicação).'],
                [b('Mural: '), 'os avisos, fotos e palavras publicados pelo pastor e pela Comunicação, com quem publicou, e quem deu Amém ou coração em cada um.'],
                [b('Aniversário: '), 'se você informar, só o dia e o mês (sem o ano). A igreja vê e recebe um aviso na véspera. Você tira quando quiser, em Você.'],
                [b('Pedidos de oração: '), 'o texto do pedido, para quais pastores foi e se foi marcado como orado. ', b('Só os pastores que você escolher leem'), ' (nem o administrador vê); no pedido sem nome, nem eles sabem quem mandou. O pedido é apagado sozinho em 30 dias, e você pode apagar antes.'],
                [b('Avisos no celular: '), 'se você ativar, um identificador do aparelho para mandar as notificações. Ele some quando você sai da conta naquele aparelho.'],
                [b('Agenda do celular: '), 'se você colocar seus cultos na agenda, um link secreto que dá acesso só aos cultos em que você está escalado. Você pode trocá-lo a qualquer momento, e o antigo para de funcionar.'],
                [b('Testemunha da contagem: '), 'quem ajuda a conferir o dinheiro pelo QR, sem conta no app, deixa só o nome e o valor que contou. Essa pessoa não vê nada do caixa.'],
                [b('Financeiro: '), 'entradas, saídas, contagens de culto e quem registrou ou conferiu cada uma. Dízimos e ofertas são guardados só como totais, ', b('sem o nome de quem deu'), '.'],
                [b('Histórico: '), 'mudanças importantes (aprovar acessos, mexer em escalas, editar ou cancelar lançamentos) ficam registradas com quem fez e quando, para dar transparência e evitar erro ou fraude.'],
            )),
        s('No seu aparelho',
            p('Para abrir mais rápido e funcionar sem internet, o app guarda no próprio celular a sua sessão de login e uma cópia da escala. Tudo isso é apagado quando você sai da conta. O Hub não usa propaganda, rastreadores nem ferramentas de análise de terceiros.')),
        s('Quem vê o quê',
            lista(
                'Toda conta aprovada vê nome, apelido, foto e instrumentos das pessoas, as escalas, os repertórios e o mural. Isso é o que permite combinar os cultos e saber o que acontece na igreja.',
                'Telefone de contato: só quem serve em algum ministério ou função (e os administradores). Quem é só membro não vê o telefone de ninguém.',
                'Fotos do mural: só contas aprovadas, por links que expiram em uma hora. Elas não ficam abertas na internet.',
                'E-mails de login e pedidos de acesso: só administradores.',
                'Financeiro: só quem tem a função Tesouraria (que edita) ou Pastor (que só lê). Ser administrador não dá acesso ao caixa.',
                'Eventos marcados como publicados aparecem no site público iejb.com.br. Os demais ficam só no Hub.',
            ),
            p('Essas regras são aplicadas pelo próprio banco de dados, não só pela tela.')),
        s('Por que (base legal)',
            p('Os dados são tratados para a organização das atividades da igreja por quem participa delas, com base no legítimo interesse da IEJB e, quando você ativa algo opcional (foto, avisos no celular), no seu consentimento. O registro financeiro atende também à obrigação da igreja de prestar contas.')),
        s('Onde ficam',
            p('No Supabase, com servidores em São Paulo (Brasil), protegidos por senha e criptografia na conexão. O app é entregue pela Cloudflare. Uma cópia de segurança semanal, criptografada, é guardada por até 90 dias no GitHub. Se você entrar com o Google, o Google informa ao Hub só o seu nome e e-mail.')),
        s('Por quanto tempo',
            p('Enquanto você fizer parte da igreja. Quem sai tem a conta desativada: o nome continua nas escalas e no caixa já passados, para o histórico fazer sentido, mas a pessoa deixa de aparecer nas listas e não entra mais. Se pedir, apagamos foto, contato e e-mail de login; os registros financeiros são mantidos pelo tempo que a prestação de contas exigir.')),
        s('Seus direitos',
            p('Pela LGPD você pode pedir para ver, corrigir ou apagar os seus dados, saber com quem são compartilhados e retirar um consentimento. Contato e foto você mesmo muda na tela Equipe (tocando no seu nome); para o resto, fale com a liderança ou escreva para ', email(), '.')),
    ];
}

function termos() {
    return [
        p('Estes termos valem para quem usa o IEJB Hub, o aplicativo interno da IEJB - Igreja Evangélica do Jardim Brasil.'),
        s('Quem pode usar',
            p('Integrantes da IEJB que pediram acesso e foram aprovados por um administrador. A conta é pessoal: não empreste o login, e avise a liderança se perder o celular ou desconfiar que alguém entrou na sua conta.')),
        s('Uso combinado',
            lista(
                'Use o Hub para as atividades da igreja: escalas, repertórios, eventos, mural e caixa.',
                'Fotos do mural são da igreja e de quem aparece nelas. Não publique fora do Hub sem combinar com a Comunicação.',
                'Os contatos e fotos dos irmãos são para combinar o serviço na igreja. Não repasse para fora nem use para venda ou propaganda.',
                'Seja verdadeiro no que registra, principalmente no financeiro. Lançamentos não são apagados: um erro é cancelado com o motivo, e tudo fica no histórico.',
                'Não tente acessar o que a sua função não permite nem atrapalhar o funcionamento do app.',
            )),
        s('Contas',
            p('Os administradores podem aprovar, recusar ou desativar contas, por exemplo quando alguém deixa a igreja ou um ministério. Quando possível, a liderança conversa antes.')),
        s('O serviço',
            p('O Hub é feito com carinho para a igreja, mas pode ficar fora do ar, ter erros ou mudar. Confira o que for importante, como horários e valores, e avise a liderança se algo parecer errado. Há cópia de segurança semanal dos dados, mas o Hub não substitui os documentos oficiais da igreja.')),
        s('Privacidade',
            p('Como os seus dados são tratados está na ', h('a', { href: '#/privacidade' }, 'política de privacidade'), '.')),
        s('Mudanças e contato',
            p('Estes termos podem mudar; a data no topo mostra a última versão. Dúvidas: fale com a liderança ou escreva para ', email(), '.')),
    ];
}

export function telaDocumento(qual, conta) {
    const ePrivacidade = qual === 'privacidade';
    const titulo = ePrivacidade ? 'Política de privacidade' : 'Termos de uso';
    const outro = ePrivacidade ? h('a', { href: '#/termos' }, 'Termos de uso') : h('a', { href: '#/privacidade' }, 'Política de privacidade');
    // Sem login não há Início: o "voltar" leva à tela de entrar
    const topo = conta
        ? cabecalhoApp(conta, { modulo: ePrivacidade ? 'Privacidade' : 'Termos' })
        : h('header', { class: 'cabecalho' },
            h('div', { class: 'cabecalho-marca cabecalho-modulo' },
                h('a', { class: 'botao-voltar', href: '#/' }, icone('seta', 'icone icone-p seta-esquerda'), h('span', null, 'Entrar'))));

    return h('div', { class: `tela tela-app tela-documento${conta ? '' : ' sem-conta'}` },
        topo,
        h('main', { id: 'conteudo', class: 'app-conteudo doc' },
            h('h1', { tabindex: -1, class: 'titulo-tela' }, titulo),
            h('p', { class: 'subtitulo-tela' }, `Atualizado em ${ATUALIZADO_EM}`),
            h('div', { class: 'doc-corpo selecionavel' }, ...(ePrivacidade ? privacidade() : termos())),
            h('p', { class: 'doc-outro' }, 'Veja também: ', outro),
        ),
    );
}
