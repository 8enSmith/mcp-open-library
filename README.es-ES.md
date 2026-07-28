# MCP Open Library

[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/8enSmith/mcp-open-library)](https://archestra.ai/mcp-catalog/8ensmith__mcp-open-library)
[![Listed on Spark](https://spark.entire.vc/badges/listed.svg)](https://spark.entire.vc/assets/vb-mcp-open-library?utm_source=github&utm_medium=readme)
[![smithery badge](https://smithery.ai/badge/@8enSmith/mcp-open-library)](https://smithery.ai/server/@8enSmith/mcp-open-library)

Un servidor del Protocolo de Contexto de Modelo (MCP) para la API de Open Library que permite a los asistentes de IA buscar información sobre libros y autores.

<a href="https://glama.ai/mcp/servers/@8enSmith/mcp-open-library">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@8enSmith/mcp-open-library/badge" alt="mcp-open-library MCP server" />
</a>

## Descripción General

Este proyecto implementa un servidor MCP que proporciona herramientas para que los asistentes de IA interactúen con [Open Library](https://openlibrary.org/). Permite buscar información de libros por título, buscar autores por nombre, recuperar información detallada del autor utilizando su clave de Open Library y obtener URLs de fotos de autores utilizando su ID de Open Library (OLID). El servidor devuelve datos estructurados para la información de libros y autores.

## Características

- **Búsqueda de Libros por Título**: Buscar libros utilizando su título (`get_book_by_title`).
- **Búsqueda de Autores por Nombre**: Buscar autores utilizando su nombre (`get_authors_by_name`).
- **Obtener Detalles del Autor**: Recuperar información detallada de un autor específico utilizando su clave de Open Library (`get_author_info`).
- **Obtener Foto del Autor**: Obtener la URL de la foto de un autor utilizando su ID de Open Library (OLID) (`get_author_photo`).
- **Obtener Portada del Libro**: Obtener la URL de la imagen de portada de un libro utilizando varios identificadores (ISBN, OCLC, LCCN, OLID, ID) (`get_book_cover`).
- **Obtener Libro por ID**: Recuperar información detallada del libro utilizando varios identificadores (ISBN, LCCN, OCLC, OLID) (`get_book_by_id`).

## Instalación

### Instalación vía Smithery

Para instalar MCP Open Library en Claude Desktop automáticamente a través de [Smithery](https://smithery.ai/server/@8enSmith/mcp-open-library):

```bash
npx -y @smithery/cli install @8enSmith/mcp-open-library --client claude
```

### Instalación Manual
```bash
# Clonar el repositorio
git clone https://github.com/8enSmith/mcp-open-library.git
cd mcp-open-library

# Instalar dependencias
npm install

# Construir el proyecto
npm run build
```

## Uso

### Ejecución del Servidor

  1. Asegúrate de estar ejecutando node v22.21.1 (probablemente funcione en versiones más nuevas de node, pero esta es la que estoy usando para esta prueba). Si tienes `nvm` instalado, ejecuta `nvm use`.
  2. En el directorio raíz de `mcp-open-library` ejecuta `npm run build`
  3. A continuación, ejecuta `npm run inspector`. Una vez construido, haz clic en la URL con el parámetro de cadena de consulta `MCP_PROXY_AUTH_TOKEN` para abrir el Inspector.
  4. En el Inspector, elige el transporte 'STDIO'
  5. Asegúrate de que el comando esté configurado como 'build/index.js'
  6. Haz clic en el botón 'Connect' en el Inspector; ahora te conectarás al servidor.
  7. Haz clic en 'Tools' en la barra de menú superior derecha.
  8. Intenta ejecutar una herramienta, por ejemplo, haz clic en `get_book_by_title`.
  9. Busca un libro, por ejemplo, introduce 'The Hobbit' en el cuadro de título y luego haz clic en 'Run Tool'. El servidor devolverá los detalles del libro.

### Uso con un Cliente MCP

Este servidor implementa el Protocolo de Contexto de Modelo, lo que significa que puede ser utilizado por cualquier asistente o cliente de IA compatible con MCP, por ejemplo, [Claude Desktop](https://modelcontextprotocol.io/quickstart/user). El servidor expone las siguientes herramientas:

- `get_book_by_title`: Buscar información de libros por título.
- `get_authors_by_name`: Buscar información de autores por nombre.
- `get_author_info`: Obtener información detallada de un autor específico utilizando su Clave de Autor de Open Library.
- `get_author_photo`: Obtener la URL de la foto de un autor utilizando su ID de Autor de Open Library (OLID).
- `get_book_cover`: Obtener la URL de la imagen de portada de un libro utilizando un identificador específico (ISBN, OCLC, LCCN, OLID o ID).
- `get_book_by_id`: Obtener información detallada del libro utilizando un identificador específico (ISBN, LCCN, OCLC u OLID).

**Ejemplo de entrada para `get_book_by_title`:**
```json
{
  "title": "The Hobbit"
}
```

**Ejemplo de salida para `get_book_by_title`:**
```json
[
  {
    "title": "The Hobbit",
    "authors": [
      "J. R. R. Tolkien"
    ],
    "first_publish_year": 1937,
    "open_library_work_key": "/works/OL45883W",
    "edition_count": 120,
    "cover_url": "https://covers.openlibrary.org/b/id/10581294-M.jpg"
  }
]
```

**Ejemplo de entrada para `get_authors_by_name`:**
```json
{
  "name": "J.R.R. Tolkien"
}
```

**Ejemplo de salida para `get_authors_by_name`:**
```json
[
  {
    "key": "OL26320A",
    "name": "J. R. R. Tolkien",
    "alternate_names": [
      "John Ronald Reuel Tolkien"
    ],
    "birth_date": "3 January 1892",
    "top_work": "The Hobbit",
    "work_count": 648
  }
]
```

**Ejemplo de entrada para `get_author_info`:**
```json
{
  "author_key": "OL26320A"
}
```

**Ejemplo de salida para `get_author_info`:**
```json
{
  "name": "J. R. R. Tolkien",
  "personal_name": "John Ronald Reuel Tolkien",
  "birth_date": "3 January 1892",
  "death_date": "2 September 1973",
  "bio": "John Ronald Reuel Tolkien (1892-1973) was a major scholar of the English language, specializing in Old and Middle English. He served as the Rawlinson and Bosworth Professor of Anglo-Saxon and later the Merton Professor of English Language and Literature at Oxford University.",
  "alternate_names": ["John Ronald Reuel Tolkien"],
  "photos": [6791763],
  "key": "/authors/OL26320A",
  "remote_ids": {
    "viaf": "95218067",
    "wikidata": "Q892"
  },
  "revision": 43,
  "last_modified": {
    "type": "/type/datetime",
    "value": "2023-02-12T05:50:22.881"
  }
}
```

**Ejemplo de entrada para `get_author_photo`:**
```json
{
  "olid": "OL26320A"
}
```

**Ejemplo de salida para `get_author_photo`:**
```text
https://covers.openlibrary.org/a/olid/OL26320A-L.jpg
```

**Ejemplo de entrada para `get_book_cover`:**
```json
{
  "key": "ISBN",
  "value": "9780547928227",
  "size": "L"
}
```

**Ejemplo de salida para `get_book_cover`:**
```text
https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg
```

La herramienta `get_book_cover` acepta los siguientes parámetros:
- `key`: El tipo de identificador (uno de: `ISBN`, `OCLC`, `LCCN`, `OLID` o `ID`)
- `value`: El valor del identificador
- `size`: Tamaño de portada opcional (`S` para pequeño, `M` para mediano, `L` para grande, por defecto es `L`)

**Ejemplo de entrada para `get_book_by_id`:**
```json
{
  "idType": "isbn",
  "idValue": "9780547928227"
}
```

**Ejemplo de salida para `get_book_by_id`:**
```json
{
  "title": "The Hobbit",
  "authors": [
    "J. R. R. Tolkien"
  ],
  "publishers": [
    "Houghton Mifflin Harcourt"
  ],
  "publish_date": "October 21, 2012",
  "number_of_pages": 300,
  "isbn_13": [
    "9780547928227"
  ],
  "isbn_10": [
    "054792822X"
  ],
  "oclc": [
    "794607877"
  ],
  "olid": [
    "OL25380781M"
  ],
  "open_library_edition_key": "/books/OL25380781M",
  "open_library_work_key": "/works/OL45883W",
  "cover_url": "https://covers.openlibrary.org/b/id/8231496-M.jpg",
  "info_url": "https://openlibrary.org/books/OL25380781M/The_Hobbit",
  "preview_url": "https://archive.org/details/hobbit00tolkien"
}
```

La herramienta `get_book_by_id` acepta los siguientes parámetros:
- `idType`: El tipo de identificador (uno de: `isbn`, `lccn`, `oclc`, `olid`)
- `idValue`: El valor del identificador

Se puede ver un ejemplo de esta herramienta siendo utilizada en Claude Desktop aquí:

<img width="1132" alt="image" src="https://github.com/user-attachments/assets/0865904a-f984-4f7b-a27d-6397ac59d6d2" />

### Docker

Puedes probar este servidor MCP usando Docker. Para hacer esto, primero ejecuta:

```bash
docker build -t mcp-open-library .
docker run -p 8080:8080 mcp-open-library
```

Luego puedes probar el servidor ejecutándose dentro de Docker a través del inspector, por ejemplo:

```bash
npm run inspector http://localhost:8080
```

## Desarrollo

### Estructura del Proyecto

- `src/index.ts` - Implementación principal del servidor
- `src/types.ts` - Definiciones de tipos de TypeScript
- `src/index.test.ts` - Suite de pruebas

### Scripts Disponibles

- `npm run build` - Construye el código TypeScript
- `npm run watch` - Observa los cambios y reconstruye
- `npm test` - Ejecuta la suite de pruebas
- `npm run format` - Formatea el código con Prettier
- `npm run inspector` - Ejecuta el Inspector de MCP contra el servidor

### Ejecución de Pruebas

```bash
npm test
```

## Contribución

¡Las contribuciones son bienvenidas! Por favor, siéntete libre de enviar un pull request.

## Agradecimientos

- [Open Library API](https://openlibrary.org/developers/api)
- [Model Context Protocol](https://github.com/modelcontextprotocol/mcp)
