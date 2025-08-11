// src/app/page.tsx
'use client'; // This directive is required for Client Components

import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { configureAmplify } from '../configureAmplify';

// Configure Amplify right at the start of the client-side code
configureAmplify();

// The client is generated once and can be reused
const client = generateClient();

// Define types to match your GraphQL schema
type Note = {
  id: string;
  text: string;
  sentiment: string;
  dateCreated: string;
};

// Define the shape of the query result data
type GetNotesData = {
  getNotes: {
    items: Note[];
  }
}

// Define GraphQL operations
const createNoteMutation = `
  mutation CreateNote($text: String!, $sentiment: Sentiment!) {
    createNote(text: $text, sentiment: $sentiment) {
      id text sentiment dateCreated
    }
  }
`;

const getNotesQuery = `
  query GetNotes {
    getNotes {
      items {
        id text sentiment dateCreated
      }
    }
  }
`;

const getNotesBySentimentQuery = `
  query GetNotes {
    getNotes {
      items ($sentiment: Sentiment!) {
        id text sentiment dateCreated
      }
    }
  }
`;


export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');
  const [sentiment, setSentiment] = useState('neutral');
  const [sentimentFilter, setSentimentFilter] = useState('neutral');

  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    try {
      // Use a type assertion to inform TypeScript about the expected shape of the result.
      const result = (await client.graphql({
        query: getNotesQuery,
      })) as { data: GetNotesData };

      const fetchedNotes = result.data.getNotes.items;
      if (fetchedNotes) {
        setNotes(fetchedNotes);
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  }

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText) return;

    try {
      await client.graphql({
        query: createNoteMutation,
        variables: { text: noteText, sentiment }
      });
      setNoteText('');
      setSentiment('neutral');
      fetchNotes();
    } catch (error) {
      console.error("Error creating note:", error);
    }
  }


  async function getNotesBySentiment(sentiment: string) {   
    if (!sentiment) return;
     setSentimentFilter(sentiment)

    try {
       
      const result = (await client.graphql({
        query: getNotesBySentimentQuery,
        variables: { sentimentFilter }
      })) as { data: GetNotesData };

      const fetchedNotes = result.data.getNotes.items;
      if (fetchedNotes) {
        setNotes(fetchedNotes);
      }
    } catch (error) {
      console.error("Error creating note:", error);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-12">
      <div className="z-10 w-full max-w-2xl items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold">Notes App</h1>
      </div>

      <form onSubmit={handleCreateNote} className="w-full max-w-2xl mt-8 bg-white p-6 rounded-lg shadow-md">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full p-2 border rounded-md text-gray-800"
          rows={3}
        />
        <div className="flex justify-between items-center mt-4">
          <select
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value)}
            className="p-2 border rounded-md bg-white text-gray-800"
          >
            <option value="neutral">Neutral</option>
            <option value="happy">Happy</option>
            <option value="sad">Sad</option>
            <option value="angry">Angry</option>
          </select>
          <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Create Note
          </button>
        </div>
      </form>

      <div className="mt-12 w-full max-w-2xl">
        <label htmlFor="filterNotes">Filtrar por sentimento:</label>
        <select
            value={sentiment}
            onChange={(e) => getNotesBySentiment(e.target.value)}
            className="p-2 border rounded-md bg-white text-gray-800"
            id="filterNotes"
          >
            <option value="neutral">Neutral</option>
            <option value="happy">Happy</option>
            <option value="sad">Sad</option>
            <option value="angry">Angry</option>
        </select>
        <h2 className="text-2xl font-semibold mb-4 text-white">Your Notes</h2>
        {notes.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()).map(note => (
          <div key={note.id} className="bg-gray-800 p-4 rounded-lg mb-4 shadow">
            <p className="text-gray-300">{note.text}</p>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
              <span>Sentiment: {note.sentiment}</span>
              <span>{new Date(note.dateCreated).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
