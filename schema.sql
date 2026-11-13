CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL
);

CREATE TABLE grupos_clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT
);

CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    email VARCHAR(100),
    telefone VARCHAR(20),
    grupo_id INTEGER REFERENCES grupos_clientes(id) ON DELETE RESTRICT
);

INSERT INTO usuarios (nome, cpf, senha) VALUES 
('Administrador', '111.111.111-11', '$2b$10$zO5UQktlAVVSoZldsyOMg.udbJqMzsO5vAA8qnql//ghR6zOSWisu');

INSERT INTO grupos_clientes (nome, descricao) VALUES 
('Convênio Bronze', 'Atendimento padrão via plano básico'),
('Particular Especial', 'Consultas particulares com retorno incluso');