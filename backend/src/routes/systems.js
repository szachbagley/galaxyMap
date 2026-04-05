const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/systemsController');

router.get('/',                 ctrl.getAllSystems);
router.get('/grid/:col/:row',   ctrl.getSystemsByGrid);
router.get('/:id/nearby',       ctrl.getNearby);
router.get('/:id',              ctrl.getSystemById);
router.post('/',                ctrl.createSystem);
router.put('/:id',              ctrl.updateSystem);
router.delete('/:id',           ctrl.deleteSystem);

module.exports = router;
