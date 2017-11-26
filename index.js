const cuid = require('cuid')
const AABBDD = require('aabbdd')

class BVNode {
    constructor({box, id, parent = null, sibling = null, left = null, right = null, expandNode = true}) {
        if (typeof id === 'undefined') {
            throw new TypeError('Entity ID is required.')
        }
        if (typeof box === 'undefined') {
            throw new TypeError('Bounding box is required.')
        }

        this.box = box
        this.parent = parent
        this.sibling = sibling
        this.left = left
        this.right = right
        this.id = id

        if (expandNode) {
            this.expand()
        }
    }

    // Methods:
    isLeaf() {
        return this.right === null
    }

    swapChild(old, newNode) {
        this[(this.right === old) ? 'right' : 'left'] = newNode
    }

    refit() {
        // FIXIT: consider adding checking for children and consider returning the resultant box
        if (this.right !== null) {
            this.box = AABBDD.combine(this.right.box, this.left.box)
        }
    }

    expand() {
        this.box.extents.scale(BVNode.EXPANSION_FACTOR)
    }
}

// Static Vars
BVNode.EXPANSION_FACTOR = 1.2

/*
//FIXIT: consider checking if node ids are equal in any instance when nodes are compared for equality

// TODO: Use function lock symbol for private methods

/**
 * Key for private a uid Array.
 * @type {Symbol}
 * @private
 */
let privateDataKey = Symbol('A key for the private data of class BVH')

class BVH {
    constructor() {
        this[privateDataKey] = {
            nodeMap: {},
            freeNodes: [],
            root: null,
            isUnbranched: true,
        }
    }

    setRoot(root) {
        this[privateDataKey].root = root
    }

    getRoot() {
        return this[privateDataKey].root
    }

    clear() {
        this[privateDataKey] = {
            nodeMap: {},
            freeNodes: [],
            root: null,
            isUnbranched: true,
        }
    }

    reuseNode({box, id, parent = null, sibling = null, left = null, right = null, expandNode = true}) {
        let node = this[privateDataKey].freeNodes.pop()

        node.box = box
        node.parent = parent
        node.sibling = sibling
        node.left = left
        node.right = right
        // freeNodes are given a new id when freed up.
        if (typeof id !== 'undefined') {
            node.id = id
        }

        if (expandNode) {
            node.expand()
        }
    }

    // getMeANode(args) {
    //     if (this[privateDataKey].freeNodes.length) {
    //         return this.reuseNode(args)
    //     }

    // }

    insertNew(box, id, rootId) {
        let leaf
        // If there is a free object rebuild it and insert it with its new id
        let getMeANode = this[privateDataKey].freeNodes.length ? this.reuseNode : BVNode

        leaf = getMeANode({
            box,
            id,
            expandNode: true,
        })

        this[privateDataKey].nodeMap[id] = leaf

        let root
        if (typeof rootId === 'undefined') {
            root = this[privateDataKey].root
        } else {
            root = this[privateDataKey].nodeMap[rootId]
        }

        this.insert(leaf, root)
    }

    // Insert a leaf creating a new branch node a t appropriate spot
    insert(leaf, root) {
        if (typeof root === 'undefined') {
            root = this[privateDataKey].root
        }

        // If the tree has no nodes then set this as the root
        if (this[privateDataKey].root === null) {
            this[privateDataKey].root = leaf
            return
        }

        let leafBox = leaf.box
        // box to be used for new branch node
        let newBox
        // box to test second option for new branch
        let otherBox

        // If the tree contains multiple nodes
        if (!this[privateDataKey].isUnbranched) {
            while (root.right !== null) {
                newBox = AABBDD.combine(leafBox, root.right.box)
                otherBox = AABBDD.combine(leafBox, root.left.box)

                // Use the box with the lesser area as newBox and move down that side of the tree
                if (otherBox.getArea() < newBox.getArea()) {
                    newBox = otherBox
                    root = root.left
                } else {
                    root = root.right
                }
                // Update the parent to represent the insert
                root.parent.box = AABBDD.combine(newBox, root.sibling.box)
            }
            // If the tree contains only the root
        } else {
            newBox = AABBDD.combine(root.box, leafBox)
            this[privateDataKey].isUnbranched = false
        }

        // This process used to reuse a free node's id. I think that was in error.
        // let id = generate_uid()
        let newNode
        let args = {
            box: newBox,
            parent: root.parent,
            sibling: root.sibling,
            left: leaf,
            right: root,
            expand: false,
        }
        // Create new node or use a free one
        if (this[privateDataKey].freeNodes.length) {
            newNode = this.reuseNode(args)
        } else {
            args.id = cuid()
            newNode = new BVNode(args)
        }

        this[privateDataKey].nodeMap[newNode.id] = newNode

        // Repoint node links to represent the changes
        if (root.parent !== null) {
            root.parent.swapChild(root, newNode)
            root.sibling.sibling = newNode
        } else {
            this[privateDataKey].root = newNode
        }

        root.parent = newNode
        leaf.parent = newNode

        root.sibling = leaf
        leaf.sibling = root
    }

    // Remove a node and its parent branch
    remove(id) {
        let leaf = this[privateDataKey].nodeMap[id]

        if (!leaf) {
            return false
        }

        // not sure about this fixit. its from way back - 11-21-17
        // FIXIT: this should only be necessary while entity ids are not numbers
        // Reset node's id so that there will not be intersections when it is reused.
        leaf.id = cuid()
        this[privateDataKey].freeNodes.push(leaf)
        // Remove old id from node map.
        this[privateDataKey].nodeMap[id] = null

        // If this is the only node empty the tree
        if (this[privateDataKey].isUnbranched) {
            this[privateDataKey].root = null
            return null
        }

        // Repoint node links and remove the leaf's parent branch
        let sibling = leaf.sibling
        let parent = leaf.parent
        let grand = parent.parent

        grand.swapChild(parent, sibling)
        sibling.parent = grand
        sibling.sibling = parent.sibling
        // Dearie Me!
        sibling.sibling.sibling = sibling

        // Remove parent branch
        this[privateDataKey].nodeMap[parent.id] = null

        let oldBox

        while (grand !== null) {
            oldBox = grand.box
            grand.box = AABBDD.combine(grand.left.box, grand.right.box)

            if (grand.box.equivalent(oldBox)) {
                return grand
            }
            // This line was in the original pseudocode but I see no reason for it. Remove in several revisions 8-10-15
            // sibling = grand;
            grand = grand.parent
        }

        return this[privateDataKey].root
    }

    // Update a leaf and refit the tree as necessary
    update(entityId, newBox, velocity) {
        if ((!entityId && entityId !== 0) ||
            typeof newBox !== 'object' ||
            typeof velocity !== 'object' ||
            isNaN(velocity.x)) {
            throw new TypeError('Invalid input.')
        }

        let leaf = this[privateDataKey].nodeMap[entityId]

        // Box representing the entity's new location
        let testBox = new AABBDD(newBox)
        testBox.offset(velocity.x, velocity.y)

        // If the entity still fits within a nodes margins then no update is needed
        if (AABBDD.containsAABBDD(leaf.box, testBox)) {
            return
        }

        // Reset the leaf's box expanding it by its' new velocity
        this.updateBox(leaf, newBox, velocity)

        // Refit the tree from the leaf upwards
        this.refitUpwards(leaf.parent)

        // See if there are any beneficial rotations to be made to the tree
        this.postOrderRefit()
    }

    // Expands a leaf's newBox by its' velocity and updates the leaf
    updateBox(leaf, newBox, velocity) {
        let extents
        // let center
        extents = newBox.extents
        // center = newBox.center

        // not .expand() ing because this is is not attached to the leaf yet;
        // Must be expanded before it is swept across the velocity
        extents.scale(BVNode.EXPANSION_FACTOR)

        // if (leaf.id === 10) {
        //     console.log('here');
        //     console.log(velocity);
        // }

        // center.x += (velocity.x / 2);
        // center.y += (velocity.y / 2);

        extents.x += (Math.abs(velocity.x) / 2)
        extents.y += (Math.abs(velocity.y) / 2)

        leaf.box = newBox
    }

    // Refit each node until there is no change in area after a refit or until the root is reached
    refitUpwards(root) {
        let oldBox
        while (root !== null) {
            oldBox = root.box
            root.refit()

            if (root.box.equivalent(oldBox)) {
                return root
            }
            root = root.parent

        }
        return root
    }

    // Refit tree completing rotations and refit after reaching the bottom leaves
    postOrderRefit(root) {
        if (root === null) {
            root = this[privateDataKey].root
        }

        if (root.right === null) {
            return
        }

        this.postOrderRefit(root.left)
        this.postOrderRefit(root.right)

        // FIXIT: Should be able to return if there are no grandchildren at  all

        /*
        *          root
        *         /   \
        *        L     R
        *       / \   / \
        *     ll  lr rl  rr
        *
        *   rotations:
        *   ll <==> rr
        *   ll <==> rl
        *   R  <==> ll
        *   R  <==> lr
        *   L  <==> rl
        *   L  <==> rr
        */

        let rightGrandchildren = root.right.right !== null
        let leftGrandchildren = root.left.right !== null

        // Object binding the best cost to the nodes to be swapped for that rotation
        let bestCost = {
            // This is not the same as the area of the parent
            min: Math.floor(root.left.box.getArea() + root.right.box.getArea()),
            a: null,
            b: null,
        }

        let R = root.right
        let L = root.left

        let lr = L.right
        let ll = L.left
        let rl = R.left
        let rr = R.right

        // If there are at least grandchildren on the left
        if (leftGrandchildren) {
            // let ll = L.left
            bestCost = this.testCost(R, ll, bestCost, root)
            bestCost = this.testCost(R, lr, bestCost, root)
        }

        // If there are at least grandchildren on the right
        if (rightGrandchildren) {
            // let rl = R.left
            // let rr = R.right
            bestCost = this.testCost(L, rl, bestCost, root)
            bestCost = this.testCost(L, rr, bestCost, root)
        }

        // If there are grandchildren on both sides
        if (leftGrandchildren && rightGrandchildren) {
            bestCost = this.testCost(ll, rl, bestCost, root)
            bestCost = this.testCost(ll, rr, bestCost, root)
        }

        // Implies a refit
        if (bestCost.a !== null) {
            this.swap(bestCost.a, bestCost.b)
        }
    }

    // Returns an object with representing the better of two rotations
    // a rotate with b, vs. the current best
    testCost(a, b, best, root) {
        // a and b are not necessarily R and L
        let aArea = 0
        let bArea = 0

        // FIXIT:
        // Should also work as (a.sibling === b.parent)
        // Should also work as (b.sibling === a.parent)

        // FIXIT:
        // pretty sure this is incorrrect2D. Examine below

        // If a or b is a direct2D child of the parent then its current area will be merged with its' counterpart's siblings
        // If not then its' area will be used direct2Dly
        aArea = (a.parent !== root) ? AABBDD.combine(a.box, b.sibling.box).getArea() : a.box.getArea()
        bArea = (b.parent !== root) ? AABBDD.combine(b.box, a.sibling.box).getArea() : b.box.getArea()

        /*  Example: Figure 2.
        *       From this:
        *          root
        *         /   \
        *        .     .
        *       / \   / \
        *      a   . b   .
        *
        *        To this:
        *          root
        *         /   \
        *        .     .
        *       / \   / \
        *      b   . a   .
        */

        /*  Example: Figure 2.
        *       From this:
        *          root
        *         /   \
        *        a     .
        *       / \   / \
        *      .   . b   .
        *
        *        To this:
        *          root
        *         /   \
        *        b     .  <-- Test there area of b + the proposed area of this node.
        *             / \
        *            a   .
        *           / \
        *          .   .
        */

        let tmpMin = Math.floor(aArea + bArea)

        // console.log(tmpMin, best.min, tmpMin < best.min);

        return tmpMin < best.min ?
            {
                min: tmpMin,
                a: a,
                b: b,
            } :
            best

    }

    // Swap two nodes moving their subtrees with them.
    swap(a, b) {
        let tmpParent = a.parent
        let tmpSibling = a.sibling

        a.parent.swapChild(a, b)
        a.parent = b.parent
        a.sibling.sibling = b
        a.sibling = b.sibling

        b.parent.swapChild(b, a)
        b.parent = tmpParent
        b.sibling.sibling = a
        b.sibling = tmpSibling

        // When a or b is a grandchild of the root of this swap refit it's parent (the child of the root).
        // i.e. Refit branches of the root but never the root itself.
        if (a.sibling !== b.parent) {
            a.parent.refit()
        }
        if (b.sibling !== a.parent) {
            b.parent.refit()
        }
    }

    // Binds a list of noting collisions
    // Must be called before assigning collisions
    bindCollisionList(collisionList) {
        this[privateDataKey].collisionList = collisionList
    }

    // Called to note a collision with bound list
    assignCollision(id) {
        // this[privateDataKey].collisionList.push(new V.Entity(id)); FIXIT
        this[privateDataKey].collisionList.push(id)
    }

    // Unbinds list
    unbindCollisionList() {
        let tmpList = this[privateDataKey].collisionList
        this[privateDataKey].collisionList = null
        return tmpList
    }

    // FIXIT: fix to be iterative, not recursive
    query(leafId, nodeId) {
        if (this[privateDataKey].isUnbranched) {
            // FIXIT: Will this mean that two objects cannot collide if they're the only ones?
            return
        }

        let leaf
        let node

        // node defaults to root
        if (typeof nodeId === 'undefined') {
            node = this[privateDataKey].root
        }

        // If leafId is passed as an id then get its' object
        if (typeof leafId !== 'object') {
            leaf = this[privateDataKey].nodeMap[leafId]
            // If nodeId was also passed us it to find its' node
            if (!node) {
                node = this[privateDataKey].nodeMap[nodeId]
            }
            // If it was passed as an object then use that
        } else {
            leaf = leafId
            // IF nodeId was passed assume it is an object as well
            if (!node) {
                node = nodeId
            }
        }

        // If the nodes overlap
        if (AABBDD.intersects(leaf.box, node.box) && leaf.id !== node.id) {
            if (node.isLeaf()) {
                this.assignCollision(node.id)
            } else {
                this.query(leaf, node.left)
                this.query(leaf, node.right)
            }
        }
    }
}

module.exports = BVH
