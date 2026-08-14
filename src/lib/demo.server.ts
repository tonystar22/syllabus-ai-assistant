import type { SupabaseClient } from "@supabase/supabase-js";
import type { LectureContent, PptContent } from "@/lib/types";

type AnyClient = SupabaseClient<any, any, any>;

const DEMO_SYLLABUS_TEXT = `CS201 - DATA STRUCTURES
Department of Computer Science and Engineering | Semester 3 | Credits: 4

UNIT I - Introduction to Data Structures and Arrays
Abstract data types; Complexity analysis (time and space); Arrays and multidimensional arrays; Sparse matrices; String handling.

UNIT II - Linked Lists, Stacks and Queues
Singly linked lists; Doubly and circular linked lists; Stack ADT and applications; Infix, prefix and postfix expressions; Queue ADT; Circular queues and dequeues.

UNIT III - Trees
Tree terminology; Binary trees and representations; Binary tree traversals; Binary Search Tree operations; AVL trees and rotations; Heaps and priority queues.

UNIT IV - Graphs and Hashing
Graph representations; BFS and DFS; Minimum spanning trees (Prim, Kruskal); Shortest path (Dijkstra); Hash tables; Collision resolution techniques.

UNIT V - Sorting and Searching
Linear and binary search; Bubble, insertion and selection sort; Merge sort; Quick sort; Heap sort; External sorting; Comparison of sorting techniques.`;

const UNITS: { unit_number: number; title: string; topics: { title: string; subtopics: string[] }[] }[] = [
  {
    unit_number: 1,
    title: "Introduction to Data Structures and Arrays",
    topics: [
      { title: "Abstract Data Types", subtopics: ["Definition", "ADT vs data structure"] },
      { title: "Complexity Analysis", subtopics: ["Time complexity", "Space complexity", "Asymptotic notation"] },
      { title: "Arrays and Multidimensional Arrays", subtopics: ["Row major", "Column major"] },
      { title: "Sparse Matrices", subtopics: [] },
    ],
  },
  {
    unit_number: 2,
    title: "Linked Lists, Stacks and Queues",
    topics: [
      { title: "Singly Linked Lists", subtopics: ["Insertion", "Deletion", "Traversal"] },
      { title: "Doubly and Circular Linked Lists", subtopics: [] },
      { title: "Stack ADT and Applications", subtopics: ["Infix to postfix", "Expression evaluation"] },
      { title: "Queue ADT", subtopics: ["Circular queue", "Dequeue"] },
    ],
  },
  {
    unit_number: 3,
    title: "Trees",
    topics: [
      { title: "Binary Trees and Representations", subtopics: ["Array representation", "Linked representation"] },
      { title: "Binary Tree Traversals", subtopics: ["Inorder", "Preorder", "Postorder"] },
      { title: "Binary Search Tree", subtopics: ["Search", "Insertion", "Deletion"] },
      { title: "AVL Trees", subtopics: ["Rotations", "Balance factor"] },
    ],
  },
  {
    unit_number: 4,
    title: "Graphs and Hashing",
    topics: [
      { title: "Graph Representations", subtopics: ["Adjacency matrix", "Adjacency list"] },
      { title: "BFS and DFS", subtopics: [] },
      { title: "Minimum Spanning Trees", subtopics: ["Prim's algorithm", "Kruskal's algorithm"] },
      { title: "Hash Tables and Collision Resolution", subtopics: ["Chaining", "Open addressing"] },
    ],
  },
  {
    unit_number: 5,
    title: "Sorting and Searching",
    topics: [
      { title: "Linear and Binary Search", subtopics: [] },
      { title: "Merge Sort", subtopics: ["Divide and conquer"] },
      { title: "Quick Sort", subtopics: ["Partitioning", "Pivot selection"] },
      { title: "Heap Sort", subtopics: [] },
    ],
  },
];

const BST_LECTURE: LectureContent = {
  title: "Binary Search Tree",
  learningObjectives: [
    "Define the binary search tree property and distinguish it from a general binary tree.",
    "Perform search, insertion and deletion operations on a binary search tree.",
    "Analyse the time complexity of BST operations for balanced and skewed trees.",
    "Relate in-order traversal of a BST to sorted output.",
  ],
  introduction:
    "A Binary Search Tree (BST) is a binary tree in which every node stores a key, and the keys are arranged so that for any node, all keys in its left subtree are smaller and all keys in its right subtree are larger. This ordering turns the tree into a searchable structure: at every node the search space is halved, in the same spirit as binary search on a sorted array, while still allowing dynamic insertion and deletion. The syllabus places this topic in Unit III after binary tree representations and traversals, so the tree terminology and traversal techniques already studied are assumed here.",
  conceptExplanation:
    "Formally, a BST is either empty or consists of a root node with a key K, a left subtree L and a right subtree R, where every key in L is less than K, every key in R is greater than K, and both L and R are themselves binary search trees. Duplicate keys are either disallowed or handled by a documented convention.\n\nSearch begins at the root. The target key is compared with the current node's key: if equal, the search succeeds; if smaller, the search continues in the left subtree; if larger, it continues in the right subtree. The search fails when an empty subtree is reached. Insertion follows the same descent and attaches the new node in place of the empty subtree where the search terminated, which guarantees the BST property is preserved.\n\nDeletion has three cases. A leaf node is removed directly. A node with a single child is replaced by that child. A node with two children is replaced by its in-order predecessor (largest key in the left subtree) or in-order successor (smallest key in the right subtree), and that predecessor or successor node is then deleted from its original position using the simpler cases.\n\nAll three operations follow a single root-to-leaf path, so their cost is proportional to the height of the tree. For a reasonably balanced tree the height is O(log n), but if keys are inserted in sorted order the tree degenerates into a linked list of height n and operations degrade to O(n). This limitation motivates the AVL trees that follow in the same unit.",
  importantPoints: [
    "In-order traversal of a BST visits keys in ascending sorted order.",
    "Search, insert and delete each cost O(h), where h is the height of the tree.",
    "Height is O(log n) when balanced and O(n) in the worst (skewed) case.",
    "Deletion of a two-child node uses the in-order predecessor or successor.",
    "The BST property must hold for entire subtrees, not merely for immediate children.",
  ],
  examples: [
    "Inserting 50, 30, 70, 20, 40, 60, 80 in that order produces a balanced tree with 50 at the root, 30 and 70 as its children, and 20, 40, 60, 80 as leaves. In-order traversal yields 20 30 40 50 60 70 80.",
    "Searching for 40 in the above tree compares 40 < 50 (go left), 40 > 30 (go right) and finds 40 in two comparisons instead of scanning all seven keys.",
    "Deleting 30 (two children) replaces it with its in-order predecessor 20, giving the tree 50 -> (20, 70) with 40 as the right child of 20.",
  ],
  applications: [
    "Symbol tables in compilers, where identifiers must be inserted and looked up dynamically.",
    "Database indexing structures, where the balanced generalisation (B-tree) is derived from the same ordering idea.",
    "Maintaining dynamic ordered sets, such as leaderboards or range queries over ordered keys.",
    "Implementing ordered map and set containers in standard libraries.",
  ],
  summary:
    "A binary search tree keeps keys in a strict left-smaller / right-larger ordering, which makes search, insertion and deletion follow a single root-to-leaf path costing O(h) time. In-order traversal recovers the sorted key sequence. Performance depends entirely on the height of the tree, and the skewed worst case of O(n) leads directly into height-balanced AVL trees, the next topic of this unit.",
  importantQuestions: [
    "Define a binary search tree and state its ordering property formally.",
    "Insert the keys 45, 15, 79, 90, 10, 55, 12, 20 into an empty BST and show the resulting tree.",
    "Explain the three cases of BST deletion with a suitable example for each.",
    "Why does in-order traversal of a BST produce a sorted sequence? Justify.",
    "Compare the best-case and worst-case complexity of BST search and explain when the worst case occurs.",
  ],
  syllabusGaps: "",
};

const BST_PPT: PptContent = {
  slides: [
    {
      title: "Binary Search Tree",
      points: ["Data Structures (CS201)", "Unit III - Trees", "Ordered binary tree for dynamic search"],
      notes: "Introduce the topic and connect it to binary trees covered earlier in the unit.",
    },
    {
      title: "Learning Objectives",
      points: [
        "State the BST ordering property",
        "Perform search, insert and delete",
        "Analyse O(h) complexity",
        "Link in-order traversal to sorted output",
      ],
      notes: "Read out the objectives so students know the expected outcomes.",
    },
    {
      title: "Introduction",
      points: [
        "Binary tree with an ordering rule",
        "Left subtree keys < node key < right subtree keys",
        "Combines binary search with dynamic updates",
      ],
      notes: "Contrast with sorted arrays, which are fast to search but costly to update.",
    },
    {
      title: "Core Concept: Operations",
      points: [
        "Search: compare and descend left or right",
        "Insert: descend, attach at empty subtree",
        "Delete: leaf / one child / two children",
        "Two-child case uses predecessor or successor",
      ],
      notes: "Draw the deletion cases on the board one by one.",
    },
    {
      title: "Worked Example",
      points: [
        "Insert 50, 30, 70, 20, 40, 60, 80",
        "In-order traversal: 20 30 40 50 60 70 80",
        "Search 40 needs only two comparisons",
      ],
      notes: "Build the tree live with the class before showing the traversal.",
    },
    {
      title: "Applications",
      points: [
        "Compiler symbol tables",
        "Database indexes (B-tree family)",
        "Ordered set and map containers",
        "Dynamic ranked data",
      ],
      notes: "Mention that real systems use balanced variants.",
    },
    {
      title: "Summary",
      points: [
        "Ordering property enables O(h) operations",
        "Balanced height is O(log n)",
        "Skewed insertion degrades to O(n)",
        "Motivates AVL trees",
      ],
      notes: "Bridge to the next topic in the unit.",
    },
    {
      title: "Important Questions",
      points: [
        "Define the BST property formally",
        "Insert a given key sequence and draw the tree",
        "Explain the three deletion cases",
        "Why is in-order traversal sorted?",
      ],
      notes: "Assign two of these as tutorial work.",
    },
  ],
};

export async function createDemoSubject(supabase: AnyClient, userId: string) {
  const { data: existing } = await supabase
    .from("subjects")
    .select("id")
    .eq("faculty_id", userId)
    .eq("code", "CS201")
    .maybeSingle();
  if (existing) return { subjectId: existing.id as string, created: false };

  const { data: subject, error } = await supabase
    .from("subjects")
    .insert({
      faculty_id: userId,
      name: "Data Structures",
      code: "CS201",
      department: "Computer Science and Engineering",
      semester: "Semester 3",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("syllabi").insert({
    subject_id: subject.id,
    file_url: "",
    file_name: "CS201-data-structures-syllabus.pdf",
    extracted_text: DEMO_SYLLABUS_TEXT,
  });

  let bstTopicId: string | null = null;
  for (const unit of UNITS) {
    const { data: unitRow, error: uErr } = await supabase
      .from("units")
      .insert({ subject_id: subject.id, unit_number: unit.unit_number, title: unit.title })
      .select("id")
      .single();
    if (uErr) throw new Error(uErr.message);
    const { data: topicRows, error: tErr } = await supabase
      .from("topics")
      .insert(
        unit.topics.map((t, i) => ({
          unit_id: unitRow.id,
          title: t.title,
          subtopics: t.subtopics,
          position: i,
        })),
      )
      .select("id, title");
    if (tErr) throw new Error(tErr.message);
    const bst = topicRows?.find((t: { title: string }) => t.title === "Binary Search Tree");
    if (bst) bstTopicId = bst.id as string;
  }

  if (bstTopicId) {
    await supabase.from("content").insert({
      topic_id: bstTopicId,
      created_by: userId,
      lecture_content: BST_LECTURE,
      ppt_content: BST_PPT,
      status: "PUBLISHED",
    });
    await supabase.from("topics").update({ status: "PUBLISHED" }).eq("id", bstTopicId);
  }

  return { subjectId: subject.id as string, created: true };
}
