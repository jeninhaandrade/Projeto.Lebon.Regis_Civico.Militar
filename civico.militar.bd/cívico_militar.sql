CREATE DATABASE civico_militar;
USE civico_militar;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    login VARCHAR(50) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL);

CREATE TABLE alunos (
	id INT AUTO_INCREMENT PRIMARY KEY,
    matricula VARCHAR(10) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,	
    data_nascimento DATE,
    nome_pai VARCHAR(100),
    nome_mae VARCHAR(100),
    endereco VARCHAR(255),
    curso VARCHAR(50),
    turno VARCHAR(20),
    etapa VARCHAR(50),
    turma VARCHAR(20));
    
ALTER TABLE alunos
ADD COLUMN pontuacao_total INTEGER DEFAULT 0;

CREATE TABLE historico_pontuacao (
  id SERIAL PRIMARY KEY,
  aluno_id INTEGER NOT NULL,
  tipo VARCHAR(20) NOT NULL, -- adicionar ou remover
  pontos INTEGER NOT NULL,
  observacao TEXT NOT NULL,
  pontuacao_anterior INTEGER NOT NULL,
  pontuacao_atual INTEGER NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_aluno
    FOREIGN KEY (aluno_id)
    REFERENCES alunos(id)
    ON DELETE CASCADE
);
      