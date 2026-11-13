import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import { verificarAutenticacao } from './middleware/auth.js';

// Recriação de __dirname para ES6 Modules em Node.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuração do motor de visualização EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Parsing de formulários HTML
app.use(express.urlencoded({ extended: true }));

// Configuração de Sessão de Usuário
app.use(session({
    secret: 'chave_secreta_pequenos_passos',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }
}));

// ==========================================
// ROTAS DE AUTENTICAÇÃO (CPF E SENHA)
// ==========================================

app.get('/login', (req, res) => {
    res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
    const { cpf, senha } = req.body;

    try {
        const resultado = await pool.query('SELECT * FROM usuarios WHERE cpf = $1', [cpf]);

        if (resultado.rows.length === 0) {
            return res.render('login', { erro: 'CPF não encontrado.' });
        }

        const usuario = resultado.rows[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            return res.render('login', { erro: 'Senha incorreta.' });
        }

        req.session.usuario = {
            id: usuario.id,
            nome: usuario.nome,
            cpf: usuario.cpf
        };

        res.redirect('/clientes');
    } catch (err) {
        console.error(err);
        res.render('login', { erro: 'Erro interno ao realizar login.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// ==========================================
// ROTAS DO CRUD DE GRUPOS DE ATENDIMENTO
// ==========================================

// Lista todos os grupos cadastrados
app.get('/grupos', verificarAutenticacao, async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM grupos_clientes ORDER BY id ASC');
        res.render('grupos', {
            grupos: resultado.rows,
            usuario: req.session.usuario,
            erro: req.query.erro || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar grupos de atendimento.');
    }
});

// Cadastra um novo grupo
app.post('/grupos/novo', verificarAutenticacao, async (req, res) => {
    const { nome, descricao } = req.body;
    try {
        await pool.query(
            'INSERT INTO grupos_clientes (nome, descricao) VALUES ($1, $2)',
            [nome, descricao]
        );
        res.redirect('/grupos');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao cadastrar grupo.');
    }
});

// Exibe formulário de edição de grupo
app.get('/grupos/editar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query('SELECT * FROM grupos_clientes WHERE id = $1', [id]);
        if (resultado.rows.length === 0) {
            return res.status(404).send('Grupo não encontrado.');
        }
        res.render('editar-grupo', {
            grupo: resultado.rows[0],
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar grupo para edição.');
    }
});

// Atualiza grupo no banco
app.post('/grupos/editar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    const { nome, descricao } = req.body;
    try {
        await pool.query(
            'UPDATE grupos_clientes SET nome = $1, descricao = $2 WHERE id = $3',
            [nome, descricao, id]
        );
        res.redirect('/grupos');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao atualizar grupo.');
    }
});

// Exclui um grupo (com proteção para ON DELETE RESTRICT)
app.get('/grupos/deletar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM grupos_clientes WHERE id = $1', [id]);
        res.redirect('/grupos');
    } catch (err) {
        console.error(err);
        res.redirect('/grupos?erro=Não é possível excluir um grupo que possui clientes vinculados.');
    }
});

// ==========================================
// ROTAS DO CRUD DE CLIENTES (RELACIONAL)
// ==========================================

// Lista clientes com LEFT JOIN e filtro de busca ILIKE
app.get('/clientes', verificarAutenticacao, async (req, res) => {
    const busca = req.query.busca || '';

    try {
        const querySql = `
            SELECT c.id, c.nome_completo, c.cpf, c.email, c.telefone, c.grupo_id, g.nome AS nome_grupo
            FROM clientes c
            LEFT JOIN grupos_clientes g ON c.grupo_id = g.id
            WHERE c.nome_completo ILIKE $1
            ORDER BY c.id DESC
        `;
        const resultado = await pool.query(querySql, [`%${busca}%`]);

        res.render('clientes', {
            clientes: resultado.rows,
            usuario: req.session.usuario,
            busca: busca
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar clientes.');
    }
});

// Exibe formulário de novo cliente com lista de grupos para o <select>
app.get('/clientes/novo', verificarAutenticacao, async (req, res) => {
    try {
        const gruposResultado = await pool.query('SELECT * FROM grupos_clientes ORDER BY nome ASC');
        res.render('novo-cliente', {
            grupos: gruposResultado.rows,
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar formulário de clientes.');
    }
});

// Insere cliente com chave estrangeira grupo_id
app.post('/clientes/novo', verificarAutenticacao, async (req, res) => {
    const { nome_completo, cpf, email, telefone, grupo_id } = req.body;
    const idGrupoFinal = grupo_id ? parseInt(grupo_id) : null;

    try {
        await pool.query(
            'INSERT INTO clientes (nome_completo, cpf, email, telefone, grupo_id) VALUES ($1, $2, $3, $4, $5)',
            [nome_completo, cpf, email, telefone, idGrupoFinal]
        );
        res.redirect('/clientes');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao cadastrar cliente.');
    }
});

// Exibe formulário de edição de cliente com pré-seleção de grupo
app.get('/clientes/editar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;

    try {
        const clienteRes = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
        const gruposRes = await pool.query('SELECT * FROM grupos_clientes ORDER BY nome ASC');

        if (clienteRes.rows.length === 0) {
            return res.status(404).send('Cliente não encontrado.');
        }

        res.render('editar-cliente', {
            cliente: clienteRes.rows[0],
            grupos: gruposRes.rows,
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao buscar dados para edição.');
    }
});

// Atualiza cliente no banco
app.post('/clientes/editar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    const { nome_completo, cpf, email, telefone, grupo_id } = req.body;
    const idGrupoFinal = grupo_id ? parseInt(grupo_id) : null;

    try {
        await pool.query(
            'UPDATE clientes SET nome_completo = $1, cpf = $2, email = $3, telefone = $4, grupo_id = $5 WHERE id = $6',
            [nome_completo, cpf, email, telefone, idGrupoFinal, id]
        );
        res.redirect('/clientes');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao atualizar cliente.');
    }
});

// Deleta cliente
app.get('/clientes/deletar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
        res.redirect('/clientes');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao deletar cliente.');
    }
});

app.get('/', (req, res) => {
    res.redirect('/clientes');
});

app.listen(3000, () => {
    console.log('Servidor SSR Clínica Pequenos Passos rodando em http://localhost:3000');
});