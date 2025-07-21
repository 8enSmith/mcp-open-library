# MCP Open Library

[![smithery badge](https://smithery.ai/badge/@8enSmith/mcp-open-library)](https://smithery.ai/server/@8enSmith/mcp-open-library)

A Model Context Protocol (MCP) server for the Open Library API that enables AI assistants to search for book and author information.

<a href="https://glama.ai/mcp/servers/@8enSmith/mcp-open-library">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@8enSmith/mcp-open-library/badge" alt="mcp-open-library MCP server" />
</a>

## Overview

This project implements an MCP server that provides tools for AI assistants to interact with the [Open Library](https://openlibrary.org/). It allows searching for book information by title, searching for authors by name, retrieving detailed author information using their Open Library key, and getting URLs for author photos using their Open Library ID (OLID). The server returns structured data for book and author information.

## Features

- **Book Search by Title**: Search for books using their title (`get_book_by_title`).
- **Author Search by Name**: Search for authors using their name (`get_authors_by_name`).
- **Get Author Details**: Retrieve detailed information for a specific author using their Open Library key (`get_author_info`).
- **Get Author Photo**: Get the URL for an author's photo using their Open Library ID (OLID) (`get_author_photo`).
- **Get Book Cover**: Get the URL for a book's cover image using various identifiers (ISBN, OCLC, LCCN, OLID, ID) (`get_book_cover`).
- **Get Book by ID**: Retrieve detailed book information using various identifiers (ISBN, LCCN, OCLC, OLID) (`get_book_by_id`).

## Installation

### Installing via Smithery

To install MCP Open Library for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@8enSmith/mcp-open-library):

```bash
npx -y @smithery/cli install @8enSmith/mcp-open-library --client claude
```

### Manual Installation
```bash
# Clone the repository
git clone https://github.com/your-username/mcp-open-library.git
cd mcp-open-library

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Running the Server

You can use the MCP Inspector to test the server:

```bash
npm run inspector
```

Access the MCP Inspector and then test the tool e.g.

![alt text](image.png)

### Using with an MCP Client

This server implements the Model Context Protocol, which means it can be used by any MCP-compatible AI assistant or client e.g. [Claude Desktop](https://modelcontextprotocol.io/quickstart/user). The server exposes the following tools:

- `get_book_by_title`: Search for book information by title
- `get_authors_by_name`: Search for author information by name
- `get_author_info`: Get detailed information for a specific author using their Open Library Author Key
- `get_author_photo`: Get the URL for an author's photo using their Open Library Author ID (OLID)
- `get_book_cover`: Get the URL for a book's cover image using a specific identifier (ISBN, OCLC, LCCN, OLID, or ID)
- `get_book_by_id`: Get detailed book information using a specific identifier (ISBN, LCCN, OCLC, or OLID)

**Example `get_book_by_title` input:**
```json
{
  "title": "The Hobbit"
}
```

**Example `get_book_by_title` output:**
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

**Example `get_authors_by_name` input:**
```json
{
  "name": "J.R.R. Tolkien"
}
```

**Example `get_authors_by_name` output:**
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

**Example `get_author_info` input:**
```json
{
  "author_key": "OL26320A"
}
```

**Example `get_author_info` output:**
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

**Example `get_author_photo` input:**
```json
{
  "olid": "OL26320A"
}
```

**Example `get_author_photo` output:**
```text
https://covers.openlibrary.org/a/olid/OL26320A-L.jpg
```

**Example `get_book_cover` input:**
```json
{
  "key": "ISBN",
  "value": "9780547928227",
  "size": "L"
}
```

**Example `get_book_cover` output:**
```text
https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg
```

The `get_book_cover` tool accepts the following parameters:
- `key`: The type of identifier (one of: `ISBN`, `OCLC`, `LCCN`, `OLID`, or `ID`)
- `value`: The value of the identifier
- `size`: Optional cover size (`S` for small, `M` for medium, `L` for large, defaults to `L`)

**Example `get_book_by_id` input:**
```json
{
  "idType": "isbn",
  "idValue": "9780547928227"
}
```

**Example `get_book_by_id` output:**
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

The `get_book_by_id` tool accepts the following parameters:
- `idType`: The type of identifier (one of: `isbn`, `lccn`, `oclc`, `olid`)
- `idValue`: The value of the identifier

An example of this tool being used in Claude Desktop can be see here:

<img width="1132" alt="image" src="https://github.com/user-attachments/assets/0865904a-f984-4f7b-a27d-6397ac59d6d2" />

### Docker

You can test this MCP server using Docker. To do this first run:

```bash
docker build -t mcp-open-library .
docker run -p 8080:8080 mcp-open-library
```

You can then test the server running within Docker via the inspector e.g.

```bash
npm run inspector http://localhost:8080
```

## Development

### Project Structure

- `src/index.ts` - Main server implementation
- `src/types.ts` - TypeScript type definitions
- `src/index.test.ts` - Test suite

### Available Scripts

- `npm run build` - Build the TypeScript code
- `npm run watch` - Watch for changes and rebuild
- `npm test` - Run the test suite
- `npm run format` - Format code with Prettier
- `npm run inspector` - Run the MCP Inspector against the server

### Running Tests

```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## Acknowledgments

- [Open Library API](https://openlibrary.org/developers/api)
- [Model Context Protocol](https://github.com/modelcontextprotocol/mcp)
